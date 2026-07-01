"""MicroProjects unified API.

A single FastAPI application that mounts one router per tool under /api/<tool>/.
Shared concerns (validation, injection guard, error envelopes, subprocess
spawning) live in app.common and are reused by every router.
"""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .routers import timepunch, valuescope, ytaudio

app = FastAPI(title="MicroProjects API", version="2.0.0")

app.include_router(valuescope.router)
app.include_router(ytaudio.router)
app.include_router(timepunch.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Uniform error envelope ──────────────────────────────────────────────────
# Routers raise HTTPException(detail={"error": ...}). Normalize every error
# response (including framework validation errors) to {"error": "..."} so the
# frontend can read `j.error` consistently.
@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        body = detail
    else:
        body = {"error": detail if isinstance(detail, str) else "Request failed."}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": "Invalid or missing parameters."})
