import pytest
from app.services.resolution_engine import resolution_engine
from app.services.hindsight_service import hindsight_service

def test_experience_based_recommendation_with_recall():
    # Retain a prior success
    hindsight_service.retain(
        incident_id="prior-inc-99",
        service_name="payment-service",
        symptoms="Database connection timeout",
        root_cause="HikariPool saturation",
        solution_applied="Increased connection pool to 25 and tuned lease timeout",
        outcome="success",
        feedback_notes="Worked successfully"
    )

    # Generate recommendation for a similar incident on billing-engine
    recs = resolution_engine.generate_recommendations(
        incident_id="new-inc-101",
        service_name="billing-engine",
        title="billing-engine: HikariPool connection timeout",
        description="Workers waiting on database handle timed out after 30s",
        root_cause_summary="Connection pool exhausted"
    )

    assert len(recs) > 0
    primary_rec = recs[0]
    # Check that historical precedent was cited
    assert len(primary_rec.historical_precedents) > 0
    # Confidence score boosted because of past success
    assert primary_rec.confidence_score >= 80.0
    # Steps include scaling pool
    assert any("pool" in step.lower() for step in primary_rec.steps)

def test_cache_oom_resolution_pattern():
    recs = resolution_engine.generate_recommendations(
        incident_id="inc-cache-test",
        service_name="cache-layer",
        title="Redis Cache Saturation & OOM Under Peak Load",
        description="Redis command execution rejected due to OOM under noeviction",
        root_cause_summary="Memory ceiling reached 92% with noeviction"
    )
    assert len(recs) > 0
    assert "eviction" in recs[0].title.lower() or "cache" in recs[0].title.lower()
    assert any("allkeys-lru" in step.lower() or "eviction" in step.lower() for step in recs[0].steps)

def test_gateway_timeout_resolution_pattern():
    recs = resolution_engine.generate_recommendations(
        incident_id="inc-gw-test",
        service_name="api-gateway",
        title="API Gateway Upstream 504 Timeout on Inventory Service",
        description="Cascading 504 gateway timeout across edge routers as upstream inventory-svc dropped connections",
        root_cause_summary="Ingress edge gateway proxy timeout"
    )
    assert len(recs) > 0
    assert "gateway" in recs[0].title.lower() or "upstream" in recs[0].title.lower() or "scale" in recs[0].title.lower()
    assert any("replicas" in step.lower() or "timeout" in step.lower() for step in recs[0].steps)

