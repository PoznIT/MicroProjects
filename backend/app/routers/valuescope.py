"""ValueScope: fundamental metrics + company search, reusing the existing
fetch.py / search.py tools via the centralized subprocess runner."""

from fastapi import APIRouter, Query

from ..common import api_error, run_python_tool, valid_query, valid_ticker

router = APIRouter(prefix="/api/valuescope", tags=["valuescope"])


@router.get("/metrics")
async def metrics(symbol: str = Query(..., min_length=1, max_length=12)):
    symbol = symbol.strip()
    if not valid_ticker(symbol):
        raise api_error(400, "Enter a valid ticker symbol (e.g. AAPL).")
    return await run_python_tool("fetch.py", symbol)


@router.get("/history")
async def history(symbol: str = Query(..., min_length=1, max_length=12)):
    symbol = symbol.strip()
    if not valid_ticker(symbol):
        raise api_error(400, "Enter a valid ticker symbol (e.g. AAPL).")
    return await run_python_tool("history.py", symbol)


@router.get("/search")
async def search(q: str = Query(..., min_length=1, max_length=64)):
    query = q.strip()
    if not valid_query(query):
        raise api_error(400, "Enter a company name or ticker.")
    return await run_python_tool("search.py", query)


@router.get("/ibkr/holdings")
async def ibkr_holdings():
    # No user input: the tool reads the Flex token/query id from the server
    # environment, so there's nothing to validate or inject here. Talking to
    # IBKR (send request → poll for the statement) can take a few seconds.
    return await run_python_tool("ibkr.py", timeout=45.0)
