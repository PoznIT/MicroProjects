"""File-backed store for ValueScope's per-symbol trade log.

Trades accumulate here across IBKR imports (each Flex statement only covers up
to 365 days) plus manual entries, so the log outlives any single import. One
JSON file, guarded by a process-wide lock and written atomically — plenty for
a single-user app; unlike the tools/ scripts this runs in-process because the
lock must be shared across requests.

Layout of trades.json:
    {
      "version": 1,
      "updatedAt": "2026-07-09T12:00:00Z",
      "deletedIds": ["ibkr:123"],          # tombstones — see delete_trade()
      "trades": [ {id, source, symbol, date, time, side, quantity, price,
                   commission, currency, assetCategory, note}, ... ]
    }

Ids are namespaced: "ibkr:<Flex tradeID>" for imports (what merge_ibkr dedupes
on) and "manual:<random>" for hand-entered rows. Deleting an IBKR trade leaves
a tombstone so the next re-import doesn't resurrect it.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.environ.get("VS_DATA_DIR", Path(__file__).parent.parent / "data"))
TRADES_FILE = DATA_DIR / "trades.json"

_LOCK = threading.Lock()
_EMPTY = {"version": 1, "updatedAt": None, "deletedIds": [], "trades": []}


def _load() -> dict:
    """Read the store; a corrupt file is shelved as .bad rather than crashing
    every request (the trade log is re-importable)."""
    try:
        with open(TRADES_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("trades"), list):
            data.setdefault("deletedIds", [])
            return data
    except FileNotFoundError:
        return json.loads(json.dumps(_EMPTY))
    except (json.JSONDecodeError, OSError):
        pass
    try:
        TRADES_FILE.replace(TRADES_FILE.with_suffix(".json.bad"))
    except OSError:
        pass
    return json.loads(json.dumps(_EMPTY))


def _save(data: dict) -> None:
    """Write-temp-then-rename so a crash mid-write never truncates the log."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    tmp = TRADES_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, TRADES_FILE)


def _sort_key(trade: dict):
    return (trade.get("date") or "", trade.get("time") or "", trade.get("id") or "")


def list_trades(symbol: str | None = None) -> list[dict]:
    with _LOCK:
        trades = _load()["trades"]
    if symbol:
        symbol = symbol.upper()
        trades = [t for t in trades if t.get("symbol") == symbol]
    return sorted(trades, key=_sort_key)


def add_manual(payload: dict) -> dict:
    trade = dict(payload)
    trade["id"] = "manual:" + uuid.uuid4().hex[:12]
    trade["source"] = "manual"
    with _LOCK:
        data = _load()
        data["trades"].append(trade)
        _save(data)
    return trade


def update_trade(trade_id: str, payload: dict) -> dict | None:
    """Replace the editable fields of one trade; returns the updated trade or
    None when the id is unknown. Id/source stay fixed."""
    with _LOCK:
        data = _load()
        for i, t in enumerate(data["trades"]):
            if t.get("id") == trade_id:
                updated = {**t, **payload, "id": trade_id, "source": t.get("source")}
                data["trades"][i] = updated
                _save(data)
                return updated
    return None


def delete_trade(trade_id: str) -> bool:
    with _LOCK:
        data = _load()
        kept = [t for t in data["trades"] if t.get("id") != trade_id]
        if len(kept) == len(data["trades"]):
            return False
        data["trades"] = kept
        # Tombstone IBKR rows so the same Flex tradeID isn't re-imported.
        if trade_id.startswith("ibkr:") and trade_id not in data["deletedIds"]:
            data["deletedIds"].append(trade_id)
        _save(data)
    return True


def rename_symbol(old_symbol: str, new_symbol: str) -> int:
    """Re-point every trade filed under old_symbol to new_symbol — used when a
    holding gets relinked (e.g. an IBKR symbol Yahoo couldn't resolve, matched
    to its real listing) so the trade log follows the position instead of
    being orphaned under the old ticker. Returns how many rows moved."""
    old_symbol = old_symbol.upper()
    new_symbol = new_symbol.upper()
    if old_symbol == new_symbol:
        return 0
    count = 0
    with _LOCK:
        data = _load()
        for t in data["trades"]:
            if t.get("symbol") == old_symbol:
                t["symbol"] = new_symbol
                count += 1
        if count:
            _save(data)
    return count


def merge_ibkr(trades: list[dict]) -> dict:
    """Fold freshly imported Flex trades into the store, skipping ids we
    already hold or the user explicitly deleted. Returns counts for the UI."""
    imported = 0
    duplicates = 0
    with _LOCK:
        data = _load()
        known = {t.get("id") for t in data["trades"]}
        dead = set(data["deletedIds"])
        for t in trades or []:
            trade_id = "ibkr:" + str(t.get("tradeId") or "")
            if trade_id in known or trade_id in dead:
                duplicates += 1
                continue
            data["trades"].append({
                "id": trade_id,
                "source": "ibkr",
                "symbol": t.get("symbol"),
                "date": t.get("date"),
                "time": t.get("time"),
                "side": t.get("side"),
                "quantity": t.get("quantity"),
                "price": t.get("price"),
                "commission": t.get("commission") or 0,
                "currency": t.get("currency"),
                "assetCategory": t.get("assetCategory"),
                "note": "",
            })
            known.add(trade_id)
            imported += 1
        if imported:
            _save(data)
    return {"imported": imported, "duplicates": duplicates}
