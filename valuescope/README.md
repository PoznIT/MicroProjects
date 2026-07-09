# ValueScope

Pull fundamentals for any ticker and get a color-coded value-investing read with
a composite score, track watchlists, and keep a position trade log with
per-trade FIFO returns. Holdings and executions can be imported from
**Interactive Brokers** (Flex Web Service, or a full-history CSV).

## Stack

- **Backend** — FastAPI (Python 3.12), `backend/`. Router under
  `/api/valuescope/…` (`backend/app/routers/valuescope.py`). Shared validation,
  injection guard, `{"error": …}` envelope, and subprocess runner live in
  `app/common.py`. Market data comes from `app/tools/{fetch,search,history}.py`
  (`yfinance`) plus `app/tools/ibkr.py` (IBKR Flex Web Service, stdlib-only;
  reads `IBKR_FLEX_TOKEN`/`IBKR_FLEX_QUERY_ID` from env). The trade log persists
  via `app/trades_store.py` — a lock-guarded JSON file at `$VS_DATA_DIR`
  (`vs-data` volume in compose), with `ibkr:`/`manual:` id namespaces and
  delete-tombstones so re-imports dedupe. CRUD at `/api/valuescope/trades`,
  import via `POST /api/valuescope/ibkr/import` (365-day Flex Web Service) or
  `POST /api/valuescope/ibkr/import-csv` (a manually-run Flex Query CSV for full
  history — parsed by `app/ibkr_csv.py`, deduped by trade ID). uvicorn :8000.
- **Frontend** — Vite + React, `web/`. App shell `src/App.jsx` (react-router)
  wraps `ValueScopeLayout.jsx` (owns the single useWatchlists/useAnalysis pair),
  which renders `PortfolioView` (index) and `PositionDetail`
  (`position/:symbol` — price chart with trade markers, FIFO per-trade returns
  from `lib/trades.js`). Presentational pieces in `components/`, state/fetching
  in `hooks/`, pure logic in `lib/`. Built static, served by nginx (SPA
  fallback).
- **Auth** — `infra/auth/` (Node/Express): HMAC session cookie, `/login`,
  `/logout`, `/verify`.
- **Gateway** — `infra/nginx/nginx.conf`: routes `/api/*` → api, else → web;
  protects all but `/login`, `/logout`.
- **Compose** — `auth`, `api`, `web`, `proxy`; app at `http://localhost:8080`.

## Running locally

```bash
# 1. Configure credentials
cp .env.example .env
# Edit .env — set MP_PASSWORD and a long random MP_SECRET

# 2. Start the stack
docker compose up -d --build

# 3. Open http://localhost:8080
```

### Frontend dev server (optional)

```bash
cd web && npm install && npm run dev   # Vite on :5173, proxies /api → :8000
# in another shell:
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Run the trade-math unit tests with:

```bash
cd web && node --test src/features/valuescope/lib/trades.test.js
```

### Importing IBKR holdings & trades

ValueScope can pull the stocks/ETFs you hold at **Interactive Brokers** into its
Portfolio view — and, when your Flex Query includes the **Trades** section, your
executions too, so each position's chart shows your entry/exit points and each
trade gets its own return. It uses IBKR's **Flex Web Service** — a read-only,
token-based HTTPS report. No IB Gateway/TWS needs to run, and no trading
permission is granted. Data is end-of-day (it reflects the prior close).

Imported trades are stored server-side (the `vs-data` Docker volume) and
accumulate across imports: each import merges new executions (deduplicated by
IBKR trade ID) into the existing log, so history older than the report window is
never lost. The Flex **Web Service** (the automated **Import from IBKR** button)
reaches back at most **365 days**. To seed years of older trades in one go,
export your full history as a CSV and use **Import trades CSV** (see below).
One-off older trades can also be added by hand on the position page
(**Add trade**).

You provide two values, `IBKR_FLEX_TOKEN` and `IBKR_FLEX_QUERY_ID`, in `.env`.
To generate them, sign in to the web **Client Portal**
(<https://www.interactivebrokers.com> → Login → Portal). Flex Queries live under
**Performance & Reports**, not the Settings gear, and are web-only — they don't
appear in the mobile app or TWS.

**1. Create the Flex Query (the report definition → `IBKR_FLEX_QUERY_ID`)**

1. Go to **Performance & Reports → Flex Queries** (or **Menu ☰ → Reporting →
   Flex Queries**).
2. In the **Activity Flex Query** panel, click the **+** to create a new one.
3. Give it a name (e.g. `ValueScope Positions`).
4. Open the **Sections** list and enable **Open Positions**. Choose the summary
   option (not lot-level) and tick at least these fields: `Symbol`, `Quantity`
   (Position), `Cost Basis Price`, `Cost Basis Money`, `Currency`,
   `Asset Class` (assetCategory), `Listing Exchange`.
5. Also enable the **Trades** section — this is what feeds the per-trade
   analysis. Choose **Executions** as the level of detail and tick at least:
   `Trade ID`, `Trade Date`, `Date/Time`, `Symbol`, `Buy/Sell`, `Quantity`,
   `Trade Price`, `IB Commission`, `Currency`, `Asset Class`. (`Date/Time` keeps
   same-day fills in the right FIFO order.) Without this section the import still
   works, positions-only.
6. Under **Delivery Configuration / General**, set **Format = XML** and
   **Period = Last 365 Calendar Days** (the maximum — Open Positions always
   reflects your current holdings regardless of the period; the period governs
   how far back the Trades section reaches).
7. **Save**. Back on the Flex Queries page, note the **Query ID** shown next to
   it — that's your `IBKR_FLEX_QUERY_ID`.

**2. Generate the Flex Web Service token (→ `IBKR_FLEX_TOKEN`)**

1. Go to **Performance & Reports → Settings → Flex Web Service**.
2. Toggle the status to **Enabled** (may prompt for 2FA).
3. Click **Generate New Token** and copy it. The token is valid for up to a
   year; regenerate before it expires. Treat it like a password — it grants read
   access to your reports.

**3. Wire it up**

```bash
# in .env
IBKR_FLEX_TOKEN=your-generated-token
IBKR_FLEX_QUERY_ID=123456
```

Rebuild/restart the `api` service, open ValueScope, and click **Import from
IBKR** on the Portfolio page (or the bank icon in the watchlist panel). If the
two variables are left blank the button simply reports that IBKR isn't
configured.

### Importing your full trade history (CSV)

The Flex **Web Service** caps its reach at **365 days**, so the automated button
alone can't backfill older executions. A Flex Query **run manually** in Client
Portal has no such cap — it can span your account's entire life and be
downloaded as CSV. **Import trades CSV** on the Portfolio page loads that file.

Because every row carries IBKR's **Trade ID**, the import keys on the same
`ibkr:<TradeID>` identity the Web Service uses: trades already brought in by the
API (or a previous CSV), and any you've deleted, are recognised and **not**
re-imported. So it's safe to import the whole-history CSV even if you've already
been syncing via the button — you'll only ever add what's genuinely missing.

**1. Make a CSV-format Flex Query with a Trade ID**

You can reuse the query from above (or make a second one). It must have:

- The **Trades** section at the **Executions** level of detail, with at least
  `Trade ID`, `Trade Date`, `Date/Time`, `Symbol`, `Buy/Sell`, `Quantity`,
  `Trade Price`, `IB Commission`, `Currency`, `Asset Class`. **`Trade ID` is
  required** — it's what stops the import from duplicating trades you already
  have. (Open Positions is ignored by the CSV import; only Trades are read.)
- Under **Delivery Configuration / General**, set **Format = CSV**.

**2. Run it for your whole history and download the CSV**

1. Go to **Performance & Reports → Flex Queries**.
2. Click the **Run** (▶) icon next to the query.
3. Choose a **Custom Date Range** that covers everything — set **From** to (or
   before) the day you opened the account, **To** to today. (A single run may be
   limited to a year at a time; if so, run it once per year and import each CSV —
   the dedup means overlapping ranges are harmless.)
4. Download the resulting **`.csv`** file.

**3. Import it**

On the Portfolio page click **Import trades CSV** and pick the file. The app
reads only the **Trades** section (any Open Positions block is ignored) and
imports its stock/ETF rows — cash/forex, options and other asset classes are
skipped automatically. It reports how many new trades it added versus how many
were already present.

> Note: foreign (non-US) listings that Yahoo Finance can't resolve without an
> exchange suffix are imported but may stay unscored. Any unscored entry shows a
> **link** button — click it, search for the matching listing (e.g. `ASML.AS`),
> and pick it to re-point the entry and score it. The position you hold is kept.

> Splits caveat: chart prices from Yahoo are split-adjusted, while imported
> trade prices are your raw fills. After a split, old entries can sit far off the
> price line and lot returns can look wrong; the position page warns when the
> reconstructed share count disagrees with what IBKR reports. Edit the old trades
> (adjust quantity/price by the split ratio) to reconcile.
