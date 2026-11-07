from fastapi import APIRouter, HTTPException, Depends
from app.schemas.feedback import FeedbackCreate
from app.repositories.in_memory_repo import repository
from app.dependencies.auth import get_current_user, UserContext

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.post("")
def submit_feedback(
    payload: FeedbackCreate,
    current_user: UserContext = Depends(get_current_user)
):
    try:
        result = repository.resolve_incident(
            incident_id=payload.incident_id,
            applied_resolution=payload.solution_applied,
            outcome=payload.outcome,
            post_mortem_notes=payload.feedback_notes,
            time_to_mitigate_minutes=payload.time_to_fix_minutes or 15,
            user_id=current_user.id
        )
        return {
            "status": "success",
            "message": "Feedback submitted and retained in Hindsight agent memory",
            "incident": result["incident"],
            "retain_result": result["hindsight"],
            "details": result
        }
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=404, detail=str(e))

