import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SeverityBadge } from '../components/common/Badge';
import {
  UploadCloud,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  X,
  FileText,
  Terminal,
  Clipboard,
  Bot
} from 'lucide-react';

export default function LogUploadPage() {
  const { navigateTo, triggerRefresh, showToast, recordLatestIncident } = useApp();

  // Uploaded state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [rawLogs, setRawLogs] = useState('');
  const [ingestMode, setIngestMode] = useState('paste'); // 'paste' or 'file'

  // Interaction & UI state
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [logFilter, setLogFilter] = useState('ALL'); // ALL, ERROR, WARN, ANOMALY

  const fileInputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFile = (file) => {
    if (!file) return;
    const validExtensions = ['.log', '.txt', '.json'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      showToast('Please upload a .log, .txt, or .json file', 'error');
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(formatBytes(file.size));
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setRawLogs(e.target.result || '');
      showToast(`Loaded ${file.name}`, 'info');
    };
    reader.readAsText(file);
  };



  const handleTextChange = (text) => {
    setRawLogs(text);
    if (text.trim()) {
      if (!fileName) {
        setFileName('pasted_telemetry.log');
        setIsSample(false);
      }
      setFileSize(formatBytes(new Blob([text]).size));
    } else {
      setFileName('');
      setFileSize('');
    }
    setAnalysisResult(null);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileName('');
    setFileSize('');
    setRawLogs('');
    setIsSample(false);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!rawLogs.trim()) {
      showToast('Please upload or select a log file first', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.analyzeLogsJson(rawLogs, fileName || 'upload.log');
      setAnalysisResult(res);
      if (res?.incident_id) {
        recordLatestIncident(res.incident_id);
      }
      triggerRefresh();
      showToast(
        `Telemetry analyzed: Incident ${res.incident_number || 'INC-2026-104'} registered & ${res.logs_persisted_count || res.parsed_entries?.length || 0} logs saved`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Log analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleInvestigateInCopilot = async () => {
    if (analysisResult?.incident_id) {
      navigateTo('assistant', analysisResult.incident_id);
      return;
    }

    if (!rawLogs.trim()) {
      showToast('Please upload or select a log file first', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      const res = await api.analyzeLogsJson(rawLogs, fileName || 'upload.log');
      setAnalysisResult(res);
      if (res?.incident_id) {
        recordLatestIncident(res.incident_id);
      }
      triggerRefresh();
      navigateTo('assistant', res.incident_id);
    } catch (err) {
      showToast(err.message || 'Log analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateIncident = async () => {
    if (!analysisResult) return;
    if (analysisResult.incident_id) {
      navigateTo('incident-detail', analysisResult.incident_id);
      return;
    }
    setCreatingIncident(true);
    try {
      const res = await api.createIncidentFromAnalysis(analysisResult);
      showToast(`Incident ${res.incident.incident_number} registered`, 'success');
      triggerRefresh();
      navigateTo('incident-detail', res.incident.id);
    } catch (err) {
      showToast(err.message || 'Failed to create incident', 'error');
    } finally {
      setCreatingIncident(false);
    }
  };

  // Syntax highlighting helper for log lines
  const renderLogLine = (line, index) => {
    let levelClass = 'text-[#8BA8C2]';
    const upper = line.toUpperCase();
    if (upper.includes('FATAL') || upper.includes('CRITICAL')) {
      levelClass = 'text-rose-400 font-bold bg-rose-950/20';
    } else if (upper.includes('ERROR') || upper.includes('EXCEPTION')) {
      levelClass = 'text-rose-300';
    } else if (upper.includes('WARN')) {
      levelClass = 'text-amber-300';
    } else if (upper.includes('INFO')) {
      levelClass = 'text-[#8BA8C2]';
    } else if (upper.includes('DEBUG')) {
      levelClass = 'text-[#8BA8C2]/60';
    }

    return (
      <div key={index} className={`flex items-start px-4 py-0.5 hover:bg-[#168DCE]/10 ${levelClass}`}>
        <span className="w-10 shrink-0 text-[#168DCE]/60 select-none text-[11px] text-right pr-4 font-mono">
          {index + 1}
        </span>
        <span className="flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
          {line}
        </span>
      </div>
    );
  };

  const logLines = rawLogs ? rawLogs.split(/\r?\n/) : [];

  const filteredEntries = analysisResult
    ? (analysisResult.parsed_entries || []).filter((e) => {
        if (logFilter === 'ERROR') return ['ERROR', 'FATAL', 'CRITICAL'].includes(e.level);
        if (logFilter === 'WARN') return ['WARN', 'WARNING'].includes(e.level);
        if (logFilter === 'ANOMALY') return e.is_anomaly;
        return true;
      })
    : [];

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#168DCE]/30 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-[#38BDF8] uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-none bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]" />
              RAW INGESTION // TELEMETRY PARSER
            </span>
          </div>
          <h2 className="text-xl font-mono font-bold text-[#E2F3FF] tracking-wider uppercase">
            Log Stream Diagnostics & Analysis
          </h2>
          <p className="text-xs text-[#8BA8C2] mt-0.5">
            Ingest raw system logs to cluster error signatures, detect anomalies, and formulate incident records.
          </p>
        </div>

        {/* Unobtrusive Sample File Menu */}
        <div className="flex items-center gap-2">
          
        </div>
      </div>

      {/* Ingestion Mode Switcher */}
      <div className="flex items-center justify-between border-b border-[#168DCE]/25 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIngestMode('paste')}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm flex items-center gap-2 transition-all ${
              ingestMode === 'paste'
                ? 'bg-[#168DCE]/25 text-[#38BDF8] border border-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-[#8BA8C2] hover:text-[#E2F3FF] border border-transparent hover:border-[#168DCE]/30'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>PASTE RAW LOGS</span>
          </button>
          <button
            onClick={() => setIngestMode('file')}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-sm flex items-center gap-2 transition-all ${
              ingestMode === 'file'
                ? 'bg-[#168DCE]/25 text-[#38BDF8] border border-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-[#8BA8C2] hover:text-[#E2F3FF] border border-transparent hover:border-[#168DCE]/30'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>UPLOAD FILE / DRAG & DROP</span>
          </button>
        </div>

        {rawLogs && (
          <button
            onClick={handleClear}
            className="text-xs font-mono text-[#8BA8C2] hover:text-rose-400 flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>CLEAR BUFFER</span>
          </button>
        )}
      </div>

      {/* Ingestion Panel: Direct Paste Textarea vs File Dropzone */}
      {ingestMode === 'paste' ? (
        <div className="hud-bracket bg-[#0A1320] border border-[#168DCE]/35 rounded-sm p-4 space-y-3 shadow-[0_0_15px_rgba(22,141,206,0.1)]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#8BA8C2] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
              DIRECT TELEMETRY STREAM INPUT
            </span>
            <span className="text-[#8BA8C2]">
              {logLines.length > 0 && `${logLines.length} lines • ${fileSize || formatBytes(new Blob([rawLogs]).size)}`}
            </span>
          </div>

          <textarea
            value={rawLogs}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={`Paste raw microservice log lines or JSON telemetry here...\n\nExample:\n2026-11-07T10:14:02.115Z [payment-service] [WARN] HikariPool-1 - Connection pool acquisition approaching timeout (active=10, idle=0, waiting=42)\n2026-11-07T10:14:05.420Z [payment-service] [ERROR] org.postgresql.util.PSQLException: FATAL: remaining connection slots are reserved\n2026-11-07T10:14:08.891Z [payment-service] [FATAL] CheckoutTransactionWorker - Connection pool fully exhausted; 58 checkout transactions dropped.`}
            className="w-full h-44 bg-[#070D18] border border-[#168DCE]/40 focus:border-[#38BDF8] focus:shadow-[0_0_15px_rgba(56,189,248,0.25)] rounded-sm p-3 font-mono text-xs text-[#E2F3FF] placeholder-[#8BA8C2]/40 focus:outline-none transition-all resize-y leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-[11px] font-mono text-[#8BA8C2]">
              Supports standard syslog, Spring Boot, log4j, Docker/k8s stdout, and JSON arrays.
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !rawLogs.trim()}
              className="w-full sm:w-auto px-5 py-2 rounded-sm bg-gradient-to-b from-[#168DCE] to-[#0D6DA5] hover:from-[#38BDF8] hover:to-[#168DCE] border border-[#38BDF8] disabled:opacity-40 text-white text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(56,189,248,0.35)] active:brightness-125"
            >
              {analyzing ? (
                <>
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  <span>PARSING TELEMETRY STREAM...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>EXECUTE LOG ANALYSIS</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* File Upload / Drag & Drop Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`hud-bracket border border-dashed rounded-sm p-6 transition-all text-center flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-[#38BDF8] bg-[#168DCE]/15 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
              : fileName
              ? 'border-[#168DCE]/50 bg-[#0A1320]'
              : 'border-[#168DCE]/35 bg-[#0A1320] hover:border-[#38BDF8]/60 shadow-[0_0_15px_rgba(22,141,206,0.1)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".log,.txt,.json"
            onChange={(e) => handleFile(e.target.files[0])}
            className="hidden"
          />

          {!fileName ? (
            <>
              <div className="w-12 h-12 rounded-sm bg-[#070D18] border border-[#168DCE]/40 flex items-center justify-center text-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-mono font-semibold text-[#E2F3FF]">
                  Drag and drop log file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#38BDF8] hover:underline font-bold"
                  >
                    browse file
                  </button>
                </p>
                <p className="text-xs text-[#8BA8C2] font-mono">
                  Formats: <code className="text-[#38BDF8]">.log</code>,{' '}
                  <code className="text-[#38BDF8]">.txt</code>, or structured{' '}
                  <code className="text-[#38BDF8]">.json</code>
                </p>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-[#070D18] border border-[#168DCE]/50 flex items-center justify-center text-[#38BDF8] shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.25)]">
                  <FileCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#E2F3FF]">
                      {fileName}
                    </span>
                  </div>
                  <span className="text-xs text-[#8BA8C2] font-mono">
                    {fileSize} • {logLines.length} lines parsed
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-sm bg-[#070D18] hover:bg-[#168DCE]/20 border border-[#168DCE]/40 text-xs font-medium text-[#E2F3FF] transition-all"
                >
                  CHANGE FILE
                </button>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-sm text-[#8BA8C2] hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* B. Log Preview & C. Analysis Action */}
      <div className="hud-bracket bg-[#0A1320] border border-[#168DCE]/35 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(22,141,206,0.1)]">
        <div className="px-5 py-3 border-b border-[#168DCE]/30 flex items-center justify-between bg-[#070D18]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#E2F3FF] uppercase tracking-wide">LOG STREAM BUFFER PREVIEW</span>
            {fileName && (
              <span className="text-xs text-[#8BA8C2] font-mono">
                [{logLines.length} LINES]
              </span>
            )}
          </div>

          {/* Analysis Action Button */}
          {fileName && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !rawLogs.trim()}
                className="px-3 py-1.5 rounded-sm bg-[#0A1320] hover:bg-[#168DCE]/20 border border-[#168DCE]/40 hover:border-[#38BDF8] disabled:opacity-50 text-[#E2F3FF] text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    <span>PARSING...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>PARSE LOGS</span>
                  </>
                )}
              </button>
              <button
                onClick={handleInvestigateInCopilot}
                disabled={analyzing || !rawLogs.trim()}
                className="px-3.5 py-1.5 rounded-sm bg-gradient-to-b from-[#168DCE] to-[#0D6DA5] hover:from-[#38BDF8] hover:to-[#168DCE] border border-[#38BDF8] disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(56,189,248,0.35)] active:brightness-125 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI COPILOT ANALYSIS ➜</span>
              </button>
            </div>
          )}
        </div>

        {/* Preview Viewer */}
        <div className="h-64 overflow-y-auto bg-[#070D18] py-2 font-mono text-xs">
          {!rawLogs ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8BA8C2] gap-2">
              <FileText className="w-8 h-8 opacity-40 text-[#38BDF8]" />
              <p className="text-xs font-mono">BUFFER EMPTY. LOAD OR DRAG A LOG STREAM TO INITIALIZE.</p>
            </div>
          ) : (
            logLines.map((line, idx) => renderLogLine(line, idx))
          )}
        </div>
      </div>

      {/* D. Analysis Results */}
      {analysisResult && (
        <div className="space-y-6 pt-2">
          {/* Diagnostic Summary Card */}
          <div className="hud-bracket bg-[#0A1320] border border-[#168DCE]/50 rounded-sm p-6 shadow-[0_0_20px_rgba(22,141,206,0.18)] space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={analysisResult.detected_severity} />
                  <span className="text-xs px-2.5 py-0.5 rounded-sm bg-[#070D18] border border-[#168DCE]/40 text-[#E2F3FF] font-mono">
                    TARGET: <strong className="text-[#38BDF8]">{analysisResult.service_detected}</strong>
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-sm bg-[#070D18] border border-[#168DCE]/40 text-[#8BA8C2] font-mono">
                    {analysisResult.total_lines} lines analyzed ({analysisResult.error_count} errors, {analysisResult.warn_count} warnings)
                  </span>
                </div>

                <h3 className="text-base font-mono font-bold text-[#E2F3FF] tracking-tight">
                  {analysisResult.suggested_title}
                </h3>
              </div>

              {/* Action: View Incident & Open in AI Copilot */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => navigateTo('assistant', analysisResult.incident_id)}
                  className="px-4 py-2 rounded-sm bg-gradient-to-b from-[#168DCE] to-[#0D6DA5] hover:from-[#38BDF8] hover:to-[#168DCE] border border-[#38BDF8] text-white font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_14px_rgba(56,189,248,0.4)] transition-all shrink-0 active:brightness-125 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>INVESTIGATE IN AI COPILOT ➜</span>
                </button>
                <button
                  onClick={handleCreateIncident}
                  disabled={creatingIncident}
                  className="px-3.5 py-2 rounded-sm bg-[#0A1320] hover:bg-[#168DCE]/20 border border-[#168DCE]/40 hover:border-[#38BDF8] disabled:opacity-50 text-[#E2F3FF] font-mono font-medium text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                >
                  {creatingIncident ? (
                    <>
                      <Cpu className="w-3.5 h-3.5 animate-spin" />
                      <span>REGISTERING INCIDENT...</span>
                    </>
                  ) : analysisResult.incident_id ? (
                    <>
                      <span>VIEW INCIDENT</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>CREATE INCIDENT RECORD</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Explanation */}
            <div className="p-3.5 rounded-sm bg-[#070D18] border border-[#168DCE]/30 text-xs text-[#E2F3FF] leading-relaxed font-sans">
              <span className="font-mono font-bold text-[#38BDF8] block mb-1 uppercase text-[11px] tracking-wider">
                DIAGNOSTIC EXPLANATION:
              </span>
              {analysisResult.explanation}
            </div>

            {/* Identified Patterns */}
            {analysisResult.error_patterns?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-[#8BA8C2] font-mono uppercase">Detected Signatures:</span>
                {analysisResult.error_patterns.map((pat, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-0.5 rounded-sm bg-[#070D18] border border-[#168DCE]/50 text-[#38BDF8] font-mono shadow-[0_0_6px_rgba(56,189,248,0.2)]"
                  >
                    {pat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Parsed Telemetry Entries Table */}
          <div className="hud-bracket bg-[#0A1320] border border-[#168DCE]/35 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(22,141,206,0.1)]">
            <div className="px-5 py-3 border-b border-[#168DCE]/30 flex items-center justify-between bg-[#070D18]">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#E2F3FF]">
                <Layers className="w-4 h-4 text-[#38BDF8]" />
                <span>EXTRACTED EVENT TELEMETRY ({filteredEntries.length} ITEMS)</span>
              </div>

              <div className="flex items-center gap-1 text-xs">
                {['ALL', 'ERROR', 'WARN', 'ANOMALY'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-mono transition-all ${
                      logFilter === f
                        ? 'bg-[#168DCE] text-white font-semibold border border-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                        : 'text-[#8BA8C2] hover:text-[#E2F3FF] hover:bg-[#168DCE]/15'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#168DCE]/20 max-h-80 overflow-y-auto font-mono text-xs">
              {filteredEntries.map((entry, idx) => {
                const isError = ['ERROR', 'FATAL', 'CRITICAL'].includes(entry.level);
                return (
                  <div
                    key={entry.id || idx}
                    className={`p-3 flex items-start gap-3 transition-colors ${
                      entry.is_anomaly
                        ? 'bg-rose-950/15 hover:bg-rose-950/25'
                        : 'hover:bg-[#168DCE]/10'
                    }`}
                  >
                    <span className="text-[11px] text-[#8BA8C2] shrink-0">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '00:00:00'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-sm shrink-0 ${
                        isError
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : entry.level === 'WARN'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : 'bg-[#070D18] text-[#8BA8C2] border border-[#168DCE]/30'
                      }`}
                    >
                      {entry.level}
                    </span>
                    <span className="text-[#38BDF8] text-[11px] shrink-0 font-medium">
                      [{entry.service_name || 'service'}]
                    </span>
                    <span className="text-[#E2F3FF] flex-1 break-all">
                      {entry.message}
                    </span>
                    {entry.is_anomaly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-rose-900/60 text-rose-200 border border-rose-600/50 uppercase tracking-wider font-semibold shrink-0">
                        ANOMALY
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
