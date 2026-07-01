"""Shared concerns for all routers: validation, the injection guard,
error envelopes, and centralized async subprocess spawning of external tools.

Every router uses these helpers so input validation and process handling live
in exactly one place.
"""

import asyncio
import json
import re
from pathlib import Path

from fastapi import HTTPException

# ── Paths ────────────────────────────────────────────────────────────────
TOOLS_DIR = Path(__file__).parent / "tools"

# ── Validation patterns (the injection guard) ──────────────────────────────
# Tickers: short alphanumerics with optional dot/dash for share classes.
TICKER_RE = re.compile(r"^[A-Za-z0-9.\-]{1,12}$")
# Free-text company queries: letters, digits, spaces and a few real-name marks.
QUERY_RE = re.compile(r"^[A-Za-z0-9 .,&'\-]{1,64}$")


def valid_ticker(value: str) -> bool:
    return isinstance(value, str) and bool(TICKER_RE.match(value))


def valid_query(value: str) -> bool:
    return isinstance(value, str) and bool(QUERY_RE.match(value))


# ── Error envelope ──────────────────────────────────────────────────────────
def api_error(status: int, message: str) -> HTTPException:
    """Return an HTTPException whose body is {"error": "..."} — the single
    envelope shape every frontend page expects."""
    return HTTPException(status_code=status, detail={"error": message})


# ── Subprocess runner ───────────────────────────────────────────────────────
async def run(cmd: str, *args: str, timeout: float = 90.0):
    """Run a command with arguments (never via a shell — args are passed
    positionally, so no shell metacharacter interpretation). Returns
    (returncode, stdout_str, stderr_str)."""
    proc = await asyncio.create_subprocess_exec(
        cmd, *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise api_error(504, "The operation timed out.")
    return proc.returncode, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


async def run_python_tool(script: str, *args: str, timeout: float = 90.0):
    """Spawn one of the bundled Python tools (fetch.py / search.py) and parse
    its single-line JSON output. Tools print {"error": ...} on failure and exit
    non-zero; we translate that into the standard error envelope."""
    script_path = str(TOOLS_DIR / script)
    code, stdout, stderr = await run("python3", script_path, *args, timeout=timeout)

    try:
        payload = json.loads(stdout.strip())
    except (json.JSONDecodeError, ValueError):
        # Unparseable output means the tool crashed before printing JSON.
        raise api_error(502, "The data provider returned an unexpected response.")

    if code != 0 or "error" in payload:
        # 404-class: tool ran but found nothing / bad input. Network failures
        # surface here too; 502 keeps them distinguishable from validation 400s.
        status = 404 if code != 0 else 200
        if payload.get("error"):
            raise api_error(status if status != 200 else 404, payload["error"])
    return payload
