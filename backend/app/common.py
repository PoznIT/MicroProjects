"""Shared concerns for all routers: the error envelope and centralized async
subprocess spawning of external tools.

Every router uses these helpers so error shaping and process handling live in
exactly one place.
"""

import asyncio

from fastapi import HTTPException


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
