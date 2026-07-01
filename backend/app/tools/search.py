#!/usr/bin/env python3
"""Search for ticker symbols by company name (or partial name / ticker).

Usage:   python3 search.py "apple"
Output:  a single JSON object on stdout, e.g.
         {"results": [{"symbol": "AAPL", "name": "Apple Inc.",
                       "exchange": "NASDAQ", "type": "EQUITY"}, ...]}
         On failure: {"error": "..."} with a non-zero exit code.

Primary path hits Yahoo Finance's public search endpoint directly with a
browser User-Agent (it does not require a crumb/cookie and is version-stable).
Falls back to yfinance.Search if the direct call fails. No API key.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

# Quote types worth surfacing for a fundamentals tool.
_ALLOWED_TYPES = {"EQUITY", "ETF"}
_MAX_RESULTS = 8

# A realistic UA — Yahoo returns 403/429 to the default urllib agent.
_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}


def _normalize(quotes):
    """Map raw Yahoo quote dicts to our compact result shape."""
    results, seen = [], set()
    for q in quotes:
        symbol = (q.get("symbol") or "").strip()
        if not symbol or symbol in seen:
            continue
        qtype = (q.get("quoteType") or q.get("typeDisp") or "").upper()
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
    return results


def _search_direct(query):
    """Query Yahoo's public autocomplete endpoint directly."""
    params = urllib.parse.urlencode({
        "q": query, "quotesCount": _MAX_RESULTS, "newsCount": 0,
        "listsCount": 0, "lang": "en-US", "region": "US",
    })
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        url = f"https://{host}/v1/finance/search?{params}"
        req = urllib.request.Request(url, headers=_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data.get("quotes", []) or []
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError):
            continue  # try the next host
    raise RuntimeError("direct search failed")


def _search_yfinance(query):
    """Fallback: let yfinance handle session/crumb and parse the response."""
    import yfinance as yf
    try:
        s = yf.Search(query, max_results=_MAX_RESULTS, enable_fuzzy_query=True)
    except TypeError:
        s = yf.Search(query)  # older signature without keyword args
    return s.quotes or []


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: search.py QUERY"}))
        return 2

    query = sys.argv[1].strip()
    if not query:
        print(json.dumps({"error": "Empty query."}))
        return 2

    quotes = None
    errors = []
    try:
        quotes = _search_direct(query)
    except Exception as exc:
        errors.append(f"direct: {exc}")

    if quotes is None:
        try:
            quotes = _search_yfinance(query)
        except Exception as exc:
            errors.append(f"yfinance: {exc}")
            print(json.dumps({"error": "Could not reach the search provider.",
                              "detail": " | ".join(errors)[:200]}))
            return 1

    print(json.dumps({"results": _normalize(quotes)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
