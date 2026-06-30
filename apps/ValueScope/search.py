#!/usr/bin/env python3
"""Search for ticker symbols by company name (or partial name / ticker).

Usage:   python3 search.py "apple"
Output:  a single JSON object on stdout, e.g.
         {"results": [{"symbol": "AAPL", "name": "Apple Inc.",
                       "exchange": "NMS", "type": "EQUITY"}, ...]}
         On failure: {"error": "..."} with a non-zero exit code.

Uses yfinance's Search (Yahoo Finance public autocomplete) — no API key.
"""

import json
import sys

# Quote types worth surfacing for a fundamentals tool.
_ALLOWED_TYPES = {"EQUITY", "ETF"}
_MAX_RESULTS = 8


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: search.py QUERY"}))
        return 2

    query = sys.argv[1].strip()
    if not query:
        print(json.dumps({"error": "Empty query."}))
        return 2

    try:
        import yfinance as yf
    except ImportError:
        print(json.dumps({"error": "yfinance is not installed."}))
        return 1

    try:
        search = yf.Search(query, max_results=_MAX_RESULTS, enable_fuzzy_query=True)
        quotes = search.quotes or []
    except Exception as exc:  # network / parse / API-shape errors
        print(json.dumps({"error": "Could not reach the search provider.",
                          "detail": str(exc)[:200]}))
        return 1

    results = []
    seen = set()
    for q in quotes:
        symbol = (q.get("symbol") or "").strip()
        if not symbol or symbol in seen:
            continue
        qtype = (q.get("quoteType") or "").upper()
        if qtype and qtype not in _ALLOWED_TYPES:
            continue
        name = (q.get("longname") or q.get("shortname")
                or q.get("name") or symbol)
        results.append({
            "symbol": symbol,
            "name": name,
            "exchange": q.get("exchDisp") or q.get("exchange") or "",
            "type": qtype or "EQUITY",
        })
        seen.add(symbol)

    print(json.dumps({"results": results}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
