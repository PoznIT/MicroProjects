# MicroProjects

A collection of small, focused utility tools served as a unified Docker stack.
As of v2 the tools share **one Python backend** (FastAPI) and **one React
frontend** (Vite), behind an nginx auth proxy.

## Tools

- **TimePunch** (`/timepunch`) — time tracker: punch in/out, CSV import/export, weekly balance against a 42h target. Fully client-side (browser localStorage).
- **YTAudio** (`/ytaudio`) — download the audio track from any YouTube video; best original quality or MP3 320k / FLAC. Backed by `yt-dlp`.
- **ValueScope** (`/valuescope`) — enter a ticker (or search by company name) and get a color-coded value-investing dashboard with a composite 0–100 score. Backed by `yfinance`, no API key. Optionally imports the stocks you own from Interactive Brokers into a watchlist (see [Importing IBKR holdings](#importing-ibkr-holdings-valuescope)).

## Running locally

**Prerequisites:** Docker and Docker Compose.

```bash
# 1. Configure credentials
cp .env.example .env
# Edit .env — set MP_PASSWORD and a long random MP_SECRET

# 2. Start the stack
docker compose up --build

# 3. Open http://localhost:8080
```

### Importing IBKR holdings (ValueScope)

ValueScope can pull the stocks/ETFs you hold at **Interactive Brokers** into an
"IBKR Holdings" watchlist and score each one. It uses IBKR's **Flex Web
Service** — a read-only, token-based HTTPS report of your positions. No IB
Gateway/TWS needs to run, and no trading permission is granted. Data is
end-of-day (it reflects the prior close).

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
4. Open the **Sections** list and enable **Open Positions**. Choose the
   summary option (not lot-level) and tick at least these fields:
   `Symbol`, `Quantity` (Position), `Cost Basis Price`, `Cost Basis Money`,
   `Currency`, `Asset Class` (assetCategory), `Listing Exchange`.
5. Under **Delivery Configuration / General**, set **Format = XML** and
   **Period = Last Business Day** (or "As of today").
6. **Save**. Back on the Flex Queries page, note the **Query ID** shown next to
   it — that's your `IBKR_FLEX_QUERY_ID`.

**2. Generate the Flex Web Service token (→ `IBKR_FLEX_TOKEN`)**

1. Go to **Performance & Reports → Settings → Flex Web Service** (same
   Performance & Reports area as the Flex Queries).
2. Toggle the status to **Enabled** (may prompt for 2FA).
3. Click **Generate New Token** and copy it. The token is valid for up to a
   year; regenerate before it expires. Treat it like a password — it grants
   read access to your reports.

**3. Wire it up**

```bash
# in .env
IBKR_FLEX_TOKEN=your-generated-token
IBKR_FLEX_QUERY_ID=123456
```

Rebuild/restart the `api` service, open ValueScope, and click the **bank icon**
in the watchlist panel header to import. If the two variables are left blank the
button simply reports that IBKR isn't configured.

> Note: foreign (non-US) listings that Yahoo Finance can't resolve without an
> exchange suffix are imported but may stay unscored.

### Frontend dev server (optional)

```bash
cd web && npm install && npm run dev   # Vite on :5173, proxies /api → :8000
# in another shell:
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Architecture

```text
/
├── backend/            FastAPI app — one router per tool
│   ├── app/
│   │   ├── main.py     mounts routers, uniform {"error": ...} envelope
│   │   ├── common.py   shared validation, injection guard, subprocess runner
│   │   ├── routers/    valuescope.py · ytaudio.py · timepunch.py
│   │   └── tools/      fetch.py · search.py · ibkr.py (spawned as subprocesses)
│   └── Dockerfile      python3-slim + yt-dlp + ffmpeg + deno + yfinance
├── web/                Vite + React SPA
│   ├── src/
│   │   ├── App.jsx     router + theme
│   │   ├── pages/      Home · ValueScope · YTAudio · TimePunch
│   │   └── styles/     theme.css (dark/light design tokens)
│   └── Dockerfile      multi-stage: node build → nginx serve (SPA fallback)
├── infra/
│   ├── auth/           Node.js auth service (login page, HMAC session cookies)
│   └── nginx/          gateway proxy config
└── docker-compose.yml  api + web + auth + proxy
```

Services: **auth** (sessions), **api** (FastAPI), **web** (React/nginx), **proxy**
(gateway nginx). All routes except `/login` and `/logout` are protected by an
nginx `auth_request` check; the proxy routes `/api/*` → api and everything else
→ the SPA. Sessions are HMAC-signed cookies valid for 7 days.

The unified API lives under `/api/<tool>/…` (e.g. `/api/valuescope/metrics`,
`/api/ytaudio/download`). TimePunch is client-side; its router only exposes a
health check.

## Adding a tool

1. Add a router under `backend/app/routers/` (prefix `/api/<tool>`) and include it in `main.py`. Reuse `common.py` for validation, the injection guard, error envelopes, and subprocess spawning.
2. Add a page under `web/src/pages/` and a route in `web/src/App.jsx`, plus a card in `pages/Home.jsx`.
3. No nginx/compose change needed — `/api/*` and the SPA are already routed.

## License

[MIT](LICENSE)
