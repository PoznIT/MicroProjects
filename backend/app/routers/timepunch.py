"""TimePunch: the time tracker is intentionally client-side — all state lives
in the browser's localStorage and CSV import/export happens entirely in the
React app, so there is no server-side persistence to manage.

This router exists for symmetry with the other tools and to expose a health
endpoint; it deliberately holds no data.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/timepunch", tags=["timepunch"])


@router.get("/health")
async def health():
    return {"status": "ok", "storage": "client-side (browser localStorage)"}
