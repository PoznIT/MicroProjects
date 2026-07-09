"""ValueScope: fundamental metrics, company search and the position trade log.
Market data comes from the tools/ scripts via the centralized subprocess
runner; the trade log lives in the file-backed store (app.trades_store)."""

import re
from datetime import date as date_type
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field, field_validator

from .. import trades_store
from ..common import api_error, run_python_tool, valid_query, valid_ticker

router = APIRouter(prefix="/api/valuescope", tags=["valuescope"])

# Store ids are namespaced ("ibkr:<flex id>" / "manual:<random>"); anything
# else in the path is rejected before it reaches the store.
TRADE_ID_RE = re.compile(r"^(ibkr|manual):[A-Za-z0-9]{1,32}$")


class TradeIn(BaseModel):
    """One manually entered (or edited) trade. Mirrors what the IBKR import
    produces so both sources feed the same FIFO model on the frontend."""
    symbol: str = Field(min_length=1, max_length=12)
    date: str
    time: str | None = None
    side: Literal["BUY", "SELL"]
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    commission: float = Field(default=0, ge=0)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    assetCategory: Literal["STK", "ETF"] = "STK"
    note: str = Field(default="", max_length=200)

    @field_validator("symbol")
    @classmethod
    def _symbol(cls, v: str) -> str:
        v = v.strip().upper()
        if not valid_ticker(v):
            raise ValueError("invalid ticker")
        return v

    @field_validator("date")
    @classmethod
    def _date(cls, v: str) -> str:
        date_type.fromisoformat(v)  # raises on anything but a real YYYY-MM-DD
        return v

    @field_validator("time")
    @classmethod
    def _time(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not re.fullmatch(r"\d{2}:\d{2}:\d{2}", v):
            raise ValueError("time must be HH:MM:SS")
        return v


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


@router.post("/ibkr/import")
async def ibkr_import():
    """Holdings fetch + trade-log merge: whatever executions the Flex query
    carries are folded into the store (deduped by Flex tradeID)."""
    payload = await run_python_tool("ibkr.py", timeout=45.0)
    counts = trades_store.merge_ibkr(payload.get("trades") or [])
    return {
        "asOf": payload.get("asOf"),
        "positions": payload.get("positions") or [],
        "tradesImported": counts["imported"],
        "tradesDuplicate": counts["duplicates"],
        "tradesTotal": len(trades_store.list_trades()),
    }


# ── Trade log CRUD ──────────────────────────────────────────────────────────
# Sync handlers on purpose: the store serializes writes behind a threading
# lock, so FastAPI's threadpool is the right execution context.

@router.get("/trades")
def trades_list(symbol: str | None = Query(None, min_length=1, max_length=12)):
    if symbol is not None:
        symbol = symbol.strip()
        if not valid_ticker(symbol):
            raise api_error(400, "Enter a valid ticker symbol (e.g. AAPL).")
    return {"trades": trades_store.list_trades(symbol)}


@router.post("/trades")
def trades_add(trade: TradeIn):
    return {"trade": trades_store.add_manual(trade.model_dump())}


@router.put("/trades/{trade_id}")
def trades_update(trade_id: str, trade: TradeIn):
    if not TRADE_ID_RE.match(trade_id):
        raise api_error(400, "Invalid trade id.")
    updated = trades_store.update_trade(trade_id, trade.model_dump())
    if updated is None:
        raise api_error(404, "Trade not found.")
    return {"trade": updated}


@router.delete("/trades/{trade_id}")
def trades_delete(trade_id: str):
    if not TRADE_ID_RE.match(trade_id):
        raise api_error(400, "Invalid trade id.")
    if not trades_store.delete_trade(trade_id):
        raise api_error(404, "Trade not found.")
    return {"ok": True}
