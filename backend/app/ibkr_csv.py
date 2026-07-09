"""Parse an IBKR *Flex Query* CSV into the same trade shape the XML path
(``tools/ibkr.py``) produces, so CSV-imported executions dedupe against API
imports on the IBKR trade ID.

Why this exists: the Flex *Web Service* used by ``tools/ibkr.py`` only reaches
back 365 days. A Flex Query *run manually* in Client Portal can span the whole
account history and be delivered as CSV — this parses that download. Because
every trade row carries IBKR's ``TradeID``, ``trades_store.merge_ibkr`` keys
both sources on the same ``ibkr:<TradeID>`` id and never re-imports an execution
the API (or a prior CSV) already brought in.

Real Flex CSVs concatenate one block per configured section (e.g. Open
Positions, then Trades), each with its own header row, and the Trades block
itself mixes asset classes (STK, CASH/forex, …). The parser walks the sections,
locks onto the Trades header (the one carrying a Trade ID), and keeps only its
STK/ETF rows. Column matching is tolerant of casing and punctuation so field
spellings like ``T. Price`` / ``Comm/Fee`` still line up.
"""

import csv
import hashlib
import io
import re

from .tools.ibkr import iso_date, normalize_symbol, num


class CsvImportError(ValueError):
    """Raised with a user-facing message when the CSV can't be understood; the
    router turns it into a 400 with this text."""


# Normalized header (lowercased, stripped to [a-z0-9]) -> our trade key. A few
# aliases cover the common Flex/Activity field-name spellings for one concept.
_COLUMNS = {
    "tradeid": "tradeId",
    "symbol": "symbol",
    "tradedate": "tradeDate",
    "datetime": "dateTime",
    "buysell": "side",
    "quantity": "quantity",
    "tradeprice": "price",
    "tprice": "price",
    "ibcommission": "commission",
    "commission": "commission",
    "commfee": "commission",
    "currencyprimary": "currency",
    "currency": "currency",
    "assetclass": "assetCategory",
    "assetcategory": "assetCategory",
}

_TRADE_KEYS = ("symbol", "side", "quantity", "price")


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (header or "").lower())


def _fmt_time(raw: str) -> str | None:
    """HHMMSS or HH:MM:SS (any punctuation) -> HH:MM:SS, else None."""
    digits = re.sub(r"[^0-9]", "", raw or "")
    if len(digits) >= 6:
        return f"{digits[0:2]}:{digits[2:4]}:{digits[4:6]}"
    return None


def _split_datetime(raw: str) -> tuple[str, str | None]:
    """Split a Flex DateTime cell into (date, time), tolerating the
    ``YYYYMMDD;HHMMSS``, ``YYYY-MM-DD, HH:MM:SS`` and ``YYYYMMDD HHMMSS``
    variants Flex emits depending on the query's date/time format."""
    raw = (raw or "").strip()
    if not raw:
        return "", None
    for sep in (";", ","):
        if sep in raw:
            date_part, _, time_part = raw.partition(sep)
            return date_part.strip(), _fmt_time(time_part)
    parts = raw.split()
    if len(parts) == 2:
        return parts[0], _fmt_time(parts[1])
    return raw, None


def _build_mapping(header_row: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for i, cell_name in enumerate(header_row):
        key = _COLUMNS.get(_norm(cell_name))
        if key and key not in mapping:
            mapping[key] = i
    return mapping


def _is_header(row: list[str]) -> bool:
    """True for a section header row. IBKR concatenates each Flex section (Open
    Positions, Trades, …) with its own header, so one file can hold several; a
    header carries the literal ``Symbol`` column name where data rows put a
    ticker, which tells the two apart reliably."""
    return any(_norm(c) == "symbol" for c in row)


def _cell(row: list[str], mapping: dict[str, int], key: str) -> str:
    i = mapping.get(key)
    return row[i].strip() if i is not None and i < len(row) else ""


def parse_trades_csv(text: str) -> list[dict]:
    """Return the STK/ETF executions in an IBKR Flex Query CSV, in the shape
    ``trades_store.merge_ibkr`` expects. Walks the file's sections, reads only
    the Trades section (the one with a Trade ID), and drops its non-STK/ETF
    rows. Raises CsvImportError with a user-facing message when no usable Trades
    section is present."""
    text = text.lstrip("﻿")  # drop a UTF-8 BOM Excel/IBKR may prepend
    rows = [r for r in csv.reader(io.StringIO(text)) if any((c or "").strip() for c in r)]
    if not rows:
        raise CsvImportError("The CSV file is empty.")

    mapping: dict[str, int] | None = None  # active Trades-section column map
    found_trades_section = False           # a Trades section with a Trade ID
    saw_trades_without_id = False          # a Trades-shaped section but no ID
    trades = []

    for row in rows:
        if _is_header(row):
            m = _build_mapping(row)
            has_trade_cols = all(k in m for k in _TRADE_KEYS)
            if has_trade_cols and "tradeId" in m:
                mapping = m
                found_trades_section = True
            else:
                # Another section (e.g. Open Positions) or a Trades section
                # missing its Trade ID — either way, stop consuming rows here.
                mapping = None
                saw_trades_without_id = saw_trades_without_id or has_trade_cols
            continue

        if mapping is None:
            continue  # data row outside a usable Trades section

        category = _cell(row, mapping, "assetCategory").upper()
        # A Trades section lists every asset class; keep stocks/ETFs (Flex files
        # both as STK), drop CASH/forex, options, futures, etc.
        if category and category not in ("STK", "ETF"):
            continue
        side = _cell(row, mapping, "side").upper()
        if side not in ("BUY", "SELL"):
            continue  # skips cancels ("SELL (Ca.)"), subtotal and blank rows
        symbol = normalize_symbol(_cell(row, mapping, "symbol"))
        qty = num(_cell(row, mapping, "quantity"))
        price = num(_cell(row, mapping, "price"))
        if not symbol or not qty or price is None:
            continue

        date_from_dt, time_part = _split_datetime(_cell(row, mapping, "dateTime"))
        date = iso_date(_cell(row, mapping, "tradeDate") or date_from_dt)

        trade_id = _cell(row, mapping, "tradeId")
        if not trade_id:
            # Deterministic fallback matching ibkr.py, so a re-import still dedupes.
            seed = f"{symbol}|{date}|{time_part or ''}|{side}|{qty}|{price}"
            trade_id = hashlib.sha1(seed.encode()).hexdigest()[:16]

        commission = num(_cell(row, mapping, "commission"))
        trades.append({
            "tradeId": trade_id,
            "symbol": symbol,
            "date": date,
            "time": time_part,
            "side": side,
            "quantity": abs(qty),
            "price": price,
            "commission": abs(commission) if commission is not None else 0,
            "currency": _cell(row, mapping, "currency") or None,
            "assetCategory": category or "STK",
        })

    if not trades:
        if saw_trades_without_id and not found_trades_section:
            raise CsvImportError(
                "The Trades section in this CSV has no Trade ID column. Re-run "
                "your IBKR Flex Query with the 'Trade ID' field enabled — the "
                "Trade ID is what prevents re-importing trades you already have."
            )
        if not found_trades_section:
            raise CsvImportError(
                "No Trades section found in this CSV. Export an IBKR Flex Query "
                "that includes the Trades section (Executions level) as CSV."
            )
        raise CsvImportError(
            "No stock/ETF trades found in this CSV (only cash/forex or other "
            "asset classes). Nothing to import."
        )
    trades.sort(key=lambda t: (t["date"], t["time"] or "", t["tradeId"]))
    return trades
