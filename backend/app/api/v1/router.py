from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    organizations,
    documents,
    regulations,
    impact,
    remediation,
    tasks,
    approvals,
    dashboard,
    exports
)

api_router = APIRouter()

# Register sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(regulations.router, prefix="/regulations", tags=["Regulations"])
api_router.include_router(impact.router, prefix="/impact", tags=["Impact Assessment"])
api_router.include_router(remediation.router, prefix="/remediation", tags=["Remediation Drafts"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Implementation Tasks"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Approvals"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(exports.router, prefix="/exports", tags=["Exports"])
