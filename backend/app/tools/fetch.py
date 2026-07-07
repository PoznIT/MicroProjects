#!/usr/bin/env python3
"""Fetch fundamental / value-investing metrics for a single ticker via yfinance.

Usage:   python3 fetch.py TICKER
Output:  a single JSON object on stdout. On failure, JSON with an "error" key
         and a non-zero exit code, so the Node layer can surface a clean message.

No API key required — yfinance reads Yahoo Finance's public endpoints.
"""

import json
import sys


def num(value):
    """Coerce to float, mapping NaN / None / non-numeric to None."""
    try:
        if value is None:
            return None
        f = float(value)
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError):
        return None


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: fetch.py TICKER"}))
        return 2

    symbol = sys.argv[1].strip().upper()
    if not symbol:
        print(json.dumps({"error": "Empty ticker."}))
        return 2

    try:
        import yfinance as yf
    except ImportError:
        print(json.dumps({"error": "yfinance is not installed."}))
        return 1

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
    except Exception as exc:  # network / parse errors
        print(json.dumps({"error": "Could not reach the data provider.",
                          "detail": str(exc)[:200]}))
        return 1

    # Yahoo returns a near-empty dict for unknown symbols. Require a price or
    # a company name as proof the symbol resolved to something real.
    price = num(info.get("currentPrice")) or num(info.get("regularMarketPrice"))
    name = info.get("longName") or info.get("shortName")
    if not name and price is None:
        print(json.dumps({"error": f"No data found for \"{symbol}\". "
                                   "Check the ticker symbol."}))
        return 1

    market_cap = num(info.get("marketCap"))
    free_cashflow = num(info.get("freeCashflow"))

    # Free-cash-flow yield = FCF / market cap (as a fraction).
    fcf_yield = None
    if free_cashflow is not None and market_cap:
        fcf_yield = free_cashflow / market_cap

    # debtToEquity comes as a percentage (e.g. 152.3 -> 1.523x).
    dte_raw = num(info.get("debtToEquity"))
    debt_to_equity = dte_raw / 100.0 if dte_raw is not None else None

    # Dividend yield: yfinance has shipped this both as a fraction (0.012) and
    # as a percent (1.2) across versions. Normalise to a fraction.
    div_raw = num(info.get("dividendYield"))
    dividend_yield = None
    if div_raw is not None:
        dividend_yield = div_raw / 100.0 if div_raw > 1 else div_raw

    # Asset class — "ETF", "EQUITY", "MUTUALFUND", etc. Lets the UI tell a fund
    # apart from an individual company (their fundamentals differ).
    quote_type = (info.get("quoteType") or "").upper() or None

    result = {
        "symbol": symbol,
        "name": name or symbol,
        "type": quote_type,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "price": price,
        "currency": info.get("currency"),
        "marketCap": market_cap,
        "metrics": {
            # Valuation
            "trailingPE": num(info.get("trailingPE")),
            "forwardPE": num(info.get("forwardPE")),
            "priceToBook": num(info.get("priceToBook")),
            "pegRatio": num(info.get("trailingPegRatio")) or num(info.get("pegRatio")),
            # Profitability
            "returnOnEquity": num(info.get("returnOnEquity")),
            "returnOnAssets": num(info.get("returnOnAssets")),
            "profitMargins": num(info.get("profitMargins")),
            # Financial health
            "debtToEquity": debt_to_equity,
            "currentRatio": num(info.get("currentRatio")),
            # Cash / income returned to holders
            "freeCashflowYield": fcf_yield,
            "dividendYield": dividend_yield,
            # Growth
            "revenueGrowth": num(info.get("revenueGrowth")),
            "earningsGrowth": num(info.get("earningsGrowth"))
                              if num(info.get("earningsGrowth")) is not None
                              else num(info.get("earningsQuarterlyGrowth")),
        },
    }

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
