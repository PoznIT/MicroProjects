"""Parse an IBKR *Flex Query* Trades CSV into the same trade shape the XML path
(``tools/ibkr.py``) produces, so CSV-imported executions dedupe against API
imports on the IBKR trade ID.

Why this exists: the Flex *Web Service* used by ``tools/ibkr.py`` only reaches
back 365 days. A Flex Query *run manually* in Client Portal can span the whole
account history and be delivered as CSV — this parses that download. Because
every row carries IBKR's ``TradeID``, ``trades_store.merge_ibkr`` keys both
sources on the same ``ibkr:<TradeID>`` id and never re-imports an execution the
API (or a prior CSV) already brought in.

The parser targets the clean Flex Query CSV (a header row of the selected field
names, then one row per execution). Column matching is tolerant of casing and
punctuation so field-name variants (``T. Price``, ``Comm/Fee``) still line up.
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


def parse_trades_csv(text: str) -> list[dict]:
    """Return the STK/ETF executions in an IBKR Flex Query Trades CSV, in the
    shape ``trades_store.merge_ibkr`` expects. Raises CsvImportError with a
    user-facing message when the file isn't a recognizable Trades export."""
    text = text.lstrip("\ufeff")  # drop a UTF-8 BOM Excel/IBKR may prepend
    rows = [r for r in csv.reader(io.StringIO(text)) if any((c or "").strip() for c in r)]
    if not rows:
        raise CsvImportError("The CSV file is empty.")

    mapping: dict[str, int] = {}
    for i, cell_name in enumerate(rows[0]):
        key = _COLUMNS.get(_norm(cell_name))
        if key and key not in mapping:
            mapping[key] = i

    if "tradeId" not in mapping:
        raise CsvImportError(
            "This CSV has no Trade ID column. Re-run your IBKR Flex Query with "
            "the Trades section (Executions) and the 'Trade ID' field enabled, "
            "delivered as CSV — the Trade ID is what prevents re-importing "
            "trades you already have."
        )
    if not all(k in mapping for k in ("symbol", "side", "quantity", "price")):
        raise CsvImportError(
            "Unrecognized IBKR CSV — it's missing Symbol / Buy-Sell / Quantity / "
            "Trade Price columns. Export the Flex Query's Trades section as CSV."
        )

    def cell(row: list[str], key: str) -> str:
        i = mapping.get(key)
        return row[i].strip() if i is not None and i < len(row) else ""

    trades = []
    for row in rows[1:]:
        category = cell(row, "assetCategory").upper()
        # Flex files STK for both stocks and ETFs; keep those, drop the rest.
        if category and category not in ("STK", "ETF"):
            continue
        side = cell(row, "side").upper()
        if side not in ("BUY", "SELL"):
            continue  # skips cancels ("SELL (Ca.)"), subtotal and blank rows
        symbol = normalize_symbol(cell(row, "symbol"))
        qty = num(cell(row, "quantity"))
        price = num(cell(row, "price"))
        if not symbol or not qty or price is None:
            continue

        date_from_dt, time_part = _split_datetime(cell(row, "dateTime"))
        date = iso_date(cell(row, "tradeDate") or date_from_dt)

        trade_id = cell(row, "tradeId")
        if not trade_id:
            # Deterministic fallback matching ibkr.py, so a re-import still dedupes.
            seed = f"{symbol}|{date}|{time_part or ''}|{side}|{qty}|{price}"
            trade_id = hashlib.sha1(seed.encode()).hexdigest()[:16]

        commission = num(cell(row, "commission"))
        trades.append({
            "tradeId": trade_id,
            "symbol": symbol,
            "date": date,
            "time": time_part,
            "side": side,
            "quantity": abs(qty),
            "price": price,
            "commission": abs(commission) if commission is not None else 0,
            "currency": cell(row, "currency") or None,
            "assetCategory": category or "STK",
        })

    if not trades:
        raise CsvImportError(
            "No stock/ETF trades found in this CSV. Check that it's an IBKR Flex "
            "Query Trades export at the Executions level of detail."
        )
    trades.sort(key=lambda t: (t["date"], t["time"] or "", t["tradeId"]))
    return trades
