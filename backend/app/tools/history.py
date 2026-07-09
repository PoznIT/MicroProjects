#!/usr/bin/env python3
"""Historical series backing ValueScope's expand-a-metric-into-a-graph view.

Usage:   python3 history.py TICKER
Output:  a single JSON object on stdout. On failure, JSON with an "error" key
         and a non-zero exit code, matching fetch.py so the Node/FastAPI layer
         can surface a clean message.

Yahoo (via yfinance, no API key) gives us two very different grades of history:

  * Daily closing PRICE, going back years. Clean and dense. The price-driven
    valuation multiples (P/E, P/B, yields, …) are *not* stored historically, so
    the frontend reconstructs them by scaling today's multiple with the price
    ratio. That work lives client-side; here we only ship the price line.

  * Financial STATEMENTS — only ~4 annual and ~5 quarterly snapshots. That's all
    Yahoo exposes for free, so statement-based metrics (ROE, margins, leverage,
    growth …) come back as a sparse list of real {t, v} points. Flow-over-stock
    ratios (ROE/ROA/margin) and growth use annual statements only, to avoid a
    sawtooth from mixing quarterly flows with point-in-time balances; pure
    balance-sheet ratios (D/E, current ratio) also include quarterly points.
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


def pick(df, *labels):
    """Return a {period_end -> float} dict for the first matching row label.

    yfinance's statement DataFrames are indexed by human line-item names that
    drift between tickers and releases, so we try a list of candidates.
    """
    if df is None or getattr(df, "empty", True):
        return {}
    for label in labels:
        if label in df.index:
            row = df.loc[label]
            out = {}
            for period, value in row.items():
                v = num(value)
                if v is not None:
                    out[period] = v
            if out:
                return out
    return {}


def ts(period):
    """Format a pandas Timestamp / datetime column key as YYYY-MM-DD."""
    try:
        return period.strftime("%Y-%m-%d")
    except AttributeError:
        return str(period)[:10]


def ratio_series(numer, denom, scale=1.0):
    """Build a sorted [{t, v}] series from two {period -> value} maps."""
    out = []
    for period, n in numer.items():
        d = denom.get(period)
        if d:  # non-zero, non-None
            out.append({"t": ts(period), "v": (n / d) * scale})
    out.sort(key=lambda p: p["t"])
    return out


def growth_series(values):
    """Year-over-year change from a {period -> value} map, sorted ascending."""
    items = sorted(values.items(), key=lambda kv: ts(kv[0]))
    out = []
    for i in range(1, len(items)):
        prev = items[i - 1][1]
        cur = items[i][1]
        if prev:
            out.append({"t": ts(items[i][0]), "v": (cur - prev) / abs(prev)})
    return out


def merge(*serieses):
    """Merge series, keeping one point per date (last wins), sorted ascending."""
    by_date = {}
    for s in serieses:
        for p in s:
            by_date[p["t"]] = p["v"]
    return [{"t": t, "v": by_date[t]} for t in sorted(by_date)]


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: history.py TICKER"}))
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
        hist = ticker.history(period="5y", interval="1d")
    except Exception as exc:  # network / parse errors
        print(json.dumps({"error": "Could not reach the data provider.",
                          "detail": str(exc)[:200]}))
        return 1

    if hist is None or hist.empty or "Close" not in hist.columns:
        print(json.dumps({"error": f"No price history found for \"{symbol}\"."}))
        return 1

    # Daily closing price. The frontend slices this per selected range and uses
    # it both directly and to reconstruct price-driven valuation multiples.
    price = []
    for idx, close in hist["Close"].items():
        c = num(close)
        if c is not None:
            price.append({"t": ts(idx), "c": round(c, 4)})

    # Statement snapshots. Any of these can be missing for a given ticker, in
    # which case that metric simply comes back with an empty series.
    statements = {}
    try:
        inc_a = ticker.income_stmt
        bal_a = ticker.balance_sheet
        bal_q = ticker.quarterly_balance_sheet

        net_income = pick(inc_a, "Net Income", "Net Income Common Stockholders",
                          "Net Income Continuous Operations")
        revenue = pick(inc_a, "Total Revenue", "Operating Revenue")
        equity = pick(bal_a, "Stockholders Equity", "Total Stockholder Equity",
                      "Common Stock Equity")
        assets = pick(bal_a, "Total Assets")

        equity_q = pick(bal_q, "Stockholders Equity", "Total Stockholder Equity",
                        "Common Stock Equity")
        debt_a = pick(bal_a, "Total Debt")
        debt_q = pick(bal_q, "Total Debt")
        cur_assets_a = pick(bal_a, "Current Assets", "Total Current Assets")
        cur_liab_a = pick(bal_a, "Current Liabilities",
                          "Total Current Liabilities")
        cur_assets_q = pick(bal_q, "Current Assets", "Total Current Assets")
        cur_liab_q = pick(bal_q, "Current Liabilities",
                          "Total Current Liabilities")

        # Flow-over-stock and growth: annual statements only (clean, ~4 points).
        statements["returnOnEquity"] = ratio_series(net_income, equity)
        statements["returnOnAssets"] = ratio_series(net_income, assets)
        statements["profitMargins"] = ratio_series(net_income, revenue)
        statements["revenueGrowth"] = growth_series(revenue)
        statements["earningsGrowth"] = growth_series(net_income)

        # Pure balance-sheet ratios: annual + quarterly points, comparable.
        # Total Debt is a percentage-free multiple here (matches fetch.py's x).
        statements["debtToEquity"] = merge(
            ratio_series(debt_a, equity), ratio_series(debt_q, equity_q))
        statements["currentRatio"] = merge(
            ratio_series(cur_assets_a, cur_liab_a),
            ratio_series(cur_assets_q, cur_liab_q))
    except Exception:
        # Price history alone is still useful — degrade gracefully.
        pass

    # Drop empty series so the frontend can cleanly mark a metric "no history".
    statements = {k: v for k, v in statements.items() if v}

    # Split calendar — the position page uses this to convert a trade executed
    # before a split into today's share-count terms, since the Close series
    # above is itself split-adjusted (yfinance backs out splits from history).
    splits = []
    try:
        for idx, ratio in ticker.splits.items():
            r = num(ratio)
            if r:
                splits.append({"t": ts(idx), "ratio": r})
    except Exception:
        pass

    print(json.dumps({
        "symbol": symbol,
        "price": price,
        "statements": statements,
        "splits": splits,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
