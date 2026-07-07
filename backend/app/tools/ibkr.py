#!/usr/bin/env python3
"""Fetch the account's open stock/ETF positions from Interactive Brokers via the
Flex Web Service.

Usage:   python3 ibkr.py           (takes no arguments)
Output:  a single JSON object on stdout. On failure, JSON with an "error" key
         and a non-zero exit code, so the API layer can surface a clean message.

Credentials come from the environment, never argv — so the token never appears
in the process list:
    IBKR_FLEX_TOKEN     Flex Web Service token (Account Reporting → Flex Web Service)
    IBKR_FLEX_QUERY_ID  the Query ID of an Activity Flex Query with Open Positions

The Flex Web Service is a two-step, read-only HTTPS flow (no gateway, no 2FA):
  1. SendRequest → a reference code
  2. GetStatement → the positions XML (may need a few polls while IBKR builds it)

Only STK / ETF positions are returned; options, futures and forex are dropped.
Data is end-of-day (it reflects the prior close), which is what a "stocks I own"
watchlist wants — live intraday would need the TWS/IB Gateway API instead.

Uses the standard library only (urllib + xml.etree) — no extra dependency.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService"
VERSION = "3"
USER_AGENT = "ValueScope/1.0 (+FlexWebService)"

# GetStatement polling: IBKR returns a "generation in progress" warning until the
# report is built. Poll a few times, staying well under the router's timeout.
POLL_TRIES = 6
POLL_DELAY = 3.0        # seconds between GetStatement attempts
HTTP_TIMEOUT = 20.0     # per-request socket timeout


def num(value):
    """Coerce to float, mapping NaN / None / non-numeric to None."""
    try:
        if value in (None, ""):
            return None
        f = float(value)
        return None if f != f else f  # NaN guard
    except (TypeError, ValueError):
        return None


def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return resp.read().decode("utf-8", "replace")


def normalize_symbol(symbol):
    """Map an IBKR symbol to the form yfinance expects. IBKR uses a space for
    share-class tickers (``BRK B``); yfinance uses a dash (``BRK-B``). Foreign
    listings may still not resolve on Yahoo without an exchange suffix — those
    simply come back unscored rather than mis-scored."""
    return (symbol or "").strip().upper().replace(" ", "-")


def fault(status_el):
    """Return (error_message) from a FlexStatementResponse, or None if it's a
    genuine success/warning we handle elsewhere."""
    status = (status_el.findtext("Status") or "").strip()
    if status == "Success":
        return None
    code = (status_el.findtext("ErrorCode") or "").strip()
    msg = (status_el.findtext("ErrorMessage") or "Flex request failed.").strip()
    return f"IBKR Flex error {code}: {msg}" if code else msg


def send_request(token, query_id):
    """Step 1 — ask IBKR to generate the statement; return its reference code."""
    qs = urllib.parse.urlencode({"t": token, "q": query_id, "v": VERSION})
    root = ET.fromstring(http_get(f"{BASE}/SendRequest?{qs}"))
    err = fault(root)
    if err:
        raise RuntimeError(err)
    ref = (root.findtext("ReferenceCode") or "").strip()
    if not ref:
        raise RuntimeError("IBKR did not return a reference code.")
    return ref


def get_statement(token, reference_code):
    """Step 2 — fetch the built statement, polling while it's still generating.
    Returns the parsed FlexQueryResponse root element."""
    qs = urllib.parse.urlencode({"t": token, "q": reference_code, "v": VERSION})
    url = f"{BASE}/GetStatement?{qs}"
    for attempt in range(POLL_TRIES):
        root = ET.fromstring(http_get(url))
        # A ready statement is <FlexQueryResponse>; a not-ready / error one is
        # <FlexStatementResponse> with a Status of Warn/Fail.
        if root.tag == "FlexQueryResponse":
            return root
        status = (root.findtext("Status") or "").strip()
        if status == "Warn":  # "Statement generation in progress" — retry.
            if attempt < POLL_TRIES - 1:
                time.sleep(POLL_DELAY)
                continue
            raise RuntimeError("IBKR statement was not ready in time. Try again shortly.")
        raise RuntimeError(fault(root) or "IBKR returned an unexpected response.")
    raise RuntimeError("IBKR statement was not ready in time. Try again shortly.")


def parse_positions(root):
    """Pull open STK/ETF positions out of the statement, aggregated per symbol
    (a symbol can appear as multiple summary rows across sub-accounts)."""
    as_of = None
    agg = {}  # symbol -> {quantity, cost_money, currency, assetCategory, accounts}

    for stmt in root.iter("FlexStatement"):
        to_date = (stmt.get("toDate") or "").strip()
        if to_date and not as_of:
            # toDate arrives as YYYYMMDD; present it as YYYY-MM-DD.
            as_of = f"{to_date[0:4]}-{to_date[4:6]}-{to_date[6:8]}" if len(to_date) == 8 else to_date

    for pos in root.iter("OpenPosition"):
        # Skip lot-level rows when a summary row is also present.
        if (pos.get("levelOfDetail") or "").upper() == "LOT":
            continue
        category = (pos.get("assetCategory") or "").upper()
        if category not in ("STK", "ETF"):
            continue
        symbol = normalize_symbol(pos.get("symbol"))
        qty = num(pos.get("position"))
        if not symbol or qty is None or qty == 0:
            continue
        cost_price = num(pos.get("costBasisPrice"))
        cost_money = num(pos.get("costBasisMoney"))
        if cost_money is None and cost_price is not None:
            cost_money = cost_price * qty

        entry = agg.setdefault(symbol, {
            "quantity": 0.0, "cost_money": 0.0, "have_cost": False,
            "currency": pos.get("currency"), "assetCategory": category,
        })
        entry["quantity"] += qty
        if cost_money is not None:
            entry["cost_money"] += cost_money
            entry["have_cost"] = True

    positions = []
    for symbol, e in sorted(agg.items()):
        qty = e["quantity"]
        avg_cost = (e["cost_money"] / qty) if (e["have_cost"] and qty) else None
        positions.append({
            "symbol": symbol,
            "quantity": qty,
            "avgCost": round(avg_cost, 4) if avg_cost is not None else None,
            "currency": e["currency"],
            "assetCategory": e["assetCategory"],
        })
    return as_of, positions


def main():
    token = (os.environ.get("IBKR_FLEX_TOKEN") or "").strip()
    query_id = (os.environ.get("IBKR_FLEX_QUERY_ID") or "").strip()
    if not token or not query_id:
        print(json.dumps({"error": "IBKR is not configured. Set IBKR_FLEX_TOKEN "
                                   "and IBKR_FLEX_QUERY_ID in the server environment."}))
        return 1

    try:
        ref = send_request(token, query_id)
        root = get_statement(token, ref)
        as_of, positions = parse_positions(root)
    except urllib.error.URLError as exc:
        print(json.dumps({"error": "Could not reach Interactive Brokers.",
                          "detail": str(exc)[:200]}))
        return 1
    except ET.ParseError:
        print(json.dumps({"error": "Interactive Brokers returned an unreadable response."}))
        return 1
    except RuntimeError as exc:
        print(json.dumps({"error": str(exc)[:300]}))
        return 1

    print(json.dumps({"asOf": as_of, "positions": positions}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
