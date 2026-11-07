from fastapi import APIRouter, Depends
try:
    from app.repositories.in_memory_repo import repository
    from app.services.hindsight_service import hindsight_service
    from app.dependencies.auth import get_current_user, UserContext
except ImportError:
    from ..repositories.in_memory_repo import repository
    from ..services.hindsight_service import hindsight_service
    from ..dependencies.auth import get_current_user, UserContext

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_dashboard_analytics(current_user: UserContext = Depends(get_current_user)):
    return repository.get_analytics(user_id=current_user.id)

@router.get("/learning")
def get_learning_analytics(current_user: UserContext = Depends(get_current_user)):
    incidents = repository.list_incidents(user_id=current_user.id)
    memories = hindsight_service.get_all_memories(bank_id=current_user.hindsight_bank_id)
    sorted_incidents = sorted(incidents, key=lambda item: str(item.get("created_at") or item.get("detected_at") or ""))

    progression = []
    resolved_count = 0
    successful_count = 0
    observed_times = []
    for incident in sorted_incidents:
        resolved = incident.get("status") in ["resolved", "closed"]
        if resolved:
            resolved_count += 1
            if incident.get("resolution_outcome") == "success":
                successful_count += 1
            minutes = incident.get("resolution_time_minutes")
            if isinstance(minutes, (int, float)) and minutes > 0:
                observed_times.append(minutes)
        progression.append({
            "iteration": incident.get("incident_number") or incident.get("id"),
            "success_rate": round(successful_count / resolved_count * 100, 1) if resolved_count else None,
            "mttr_minutes": incident.get("resolution_time_minutes") if resolved else None,
            "incident_id": incident.get("id"),
            "status": incident.get("status", "open"),
        })

    services_seen = set()
    comparison_cases = []
    for incident in sorted_incidents:
        service = incident.get("service_name")
        if not service or service in services_seen:
            continue
        services_seen.add(service)
        comparison_cases.append({
            "scenario": incident.get("title"),
            "service": service,
            "incident_id": incident.get("id"),
            "status": incident.get("status"),
            "root_cause": incident.get("root_cause_summary"),
            "resolution_time_minutes": incident.get("resolution_time_minutes"),
            "resolution_outcome": incident.get("resolution_outcome"),
            "applied_resolution": incident.get("applied_resolution"),
        })

    return {
        "memory_count": len(memories),
        "is_live_hindsight": hindsight_service.is_live(),
        "learning_progression": progression,
        "comparison_cases": [],
        "metrics": {
            "observed_mttr_minutes": round(sum(observed_times) / len(observed_times), 1) if observed_times else None,
            "resolved_incidents": resolved_count,
            "successful_resolutions": successful_count,
            "repeat_incident_prevention_pct": None,
            "automated_confidence_boost": None,
            "engineer_hours_saved_month": None,
        }
    }


@router.get("/graph")
def get_relationship_graph(current_user: UserContext = Depends(get_current_user)):
    """Generates the multi-tier relationship topology graph for the user's workspace."""
    incidents = repository.list_incidents(user_id=current_user.id)
    memories = hindsight_service.get_all_memories(bank_id=current_user.hindsight_bank_id)

    nodes = []
    edges = []

    # Dynamic user-isolated infrastructure services
    user_services = repository.list_services(user_id=current_user.id)
    for srv in user_services:
        s_name = srv.get("name")
        nodes.append({
            "id": f"srv_{s_name}",
            "service_id": srv.get("id"),
            "label": s_name,
            "type": "service",
            "tier": srv.get("tier", "tier-1"),
            "health": srv.get("health", "healthy"),
            "active_incident_count": srv.get("active_incident_count", 0),
            "description": srv.get("description", "")
        })

    for inc in incidents:
        inc_id = inc.get("id")
        nodes.append({
            "id": inc_id,
            "label": inc.get("incident_number") or f"INC-{inc_id[:6]}",
            "type": "incident",
            "service_name": inc.get("service_name"),
            "title": inc.get("title"),
            "severity": inc.get("severity", "high"),
            "status": inc.get("status", "open"),
            "time_to_fix": inc.get("resolution_time_minutes", 15)
        })
        edges.append({
            "id": f"edge_srv_{inc_id}",
            "source": f"srv_{inc.get('service_name')}",
            "target": inc_id,
            "label": "impacts"
        })

    for mem in memories:
        mem_id = mem.get("id")
        nodes.append({
            "id": mem_id,
            "label": mem_id,
            "type": "memory",
            "service_name": mem.get("service_name"),
            "outcome": mem.get("outcome", "success"),
            "resolution": mem.get("applied_resolution") or mem.get("solution_applied") or "Resolved via configuration update",
            "incident_id": mem.get("incident_id"),
            "incident_number": mem.get("incident_number")
        })
        if mem.get("incident_id"):
            edges.append({
                "id": f"edge_mem_{mem_id}",
                "source": mem.get("incident_id"),
                "target": mem_id,
                "label": "retained_as"
            })

    return {
        "nodes": nodes,
        "edges": edges
    }

