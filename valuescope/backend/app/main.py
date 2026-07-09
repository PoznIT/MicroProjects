"""ValueScope API.

A FastAPI application exposing ValueScope under /api/valuescope/…: fundamental
metrics, company search, price history, and the position trade log. Shared
concerns (validation, injection guard, error envelopes, subprocess spawning)
live in app.common.
"""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .routers import valuescope

app = FastAPI(title="ValueScope API", version="1.0.0")

app.include_router(valuescope.router)


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
