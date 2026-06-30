# ValueScope

Type a stock ticker and get its key fundamental metrics laid out as a
color-coded dashboard, with a composite score summarizing how attractive the
company looks through a classic value-investing lens.

## What it shows

For a given ticker, ValueScope fetches and rates:

| Group | Metrics |
| --- | --- |
| **Valuation** | P/E (trailing & forward), P/B, PEG |
| **Profitability** | ROE, ROA, net profit margin |
| **Financial health** | Debt/Equity, current ratio |
| **Cash & dividends** | Free-cash-flow yield, dividend yield |
| **Growth** | Revenue growth, earnings growth |

Each metric is colored against a common value-investing rule of thumb —
green (favorable), blue (acceptable), red (caution), grey (no data) — and the
ratings are rolled up into a **0–100 composite score** with a verdict
(*Attractive / Mixed / Unattractive*).

## Company search

You don't need to know the exact ticker. Start typing a company name (or a
partial name / symbol) and a dropdown of matching companies appears — pick one
to analyze it. Power users can still type a ticker like `AAPL` and hit Analyze.

Search is backed by `yfinance.Search` (Yahoo Finance's public autocomplete, no
API key). `search.py` returns up to 8 equity/ETF candidates as
`{symbol, name, exchange, type}`.

## Data source

[`yfinance`](https://pypi.org/project/yfinance/) reads Yahoo Finance's public
endpoints. No API key required. The Node layer never touches the network
itself — it validates input, then spawns `search.py` (name → candidates) or
`fetch.py` (ticker → normalized metrics), each of which returns a JSON blob.

## Thresholds

| Metric | Favorable | Acceptable |
| --- | --- | --- |
| P/E, Forward P/E | ≤ 15× | ≤ 25× |
| P/B | ≤ 1.5× | ≤ 3× |
| PEG | ≤ 1× | ≤ 2× |
| ROE | ≥ 15% | ≥ 8% |
| ROA | ≥ 7% | ≥ 3% |
| Net margin | ≥ 15% | ≥ 5% |
| Debt/Equity | ≤ 0.5× | ≤ 1.0× |
| Current ratio | ≥ 2× | ≥ 1× |
| FCF yield | ≥ 6% | ≥ 3% |
| Dividend yield* | ≥ 3% | ≥ 1% |
| Revenue growth | ≥ 10% | ≥ 3% |
| Earnings growth | ≥ 10% | ≥ 0% |

\* Dividend yield is optional — a missing or zero dividend does not lower the
score. Thresholds are deliberately generic and ignore sector context.

## Structure

```text
ValueScope/
├── server.js          Express service: validates input, spawns search.py / fetch.py
├── search.py          yfinance company-name search → candidate symbols (JSON)
├── fetch.py           yfinance lookup → normalized JSON metrics
├── public/index.html  Single-file dashboard with autocomplete (shared MP theme)
├── package.json
└── Dockerfile         node:20-slim + python3 + yfinance
```

## Running standalone

```bash
cd apps/ValueScope
docker build -t valuescope .
docker run --rm -p 3000:3000 valuescope
# open http://localhost:3000
```

Within the full stack it's served at `/valuescope/` behind the auth proxy.

## Notes

- Invalid or unknown tickers return a clean error; missing individual metrics
  render as `—` and are excluded from the score.
- Informational only — **not investment advice.**
