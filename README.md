# MicroProjects

A collection of small, focused utility tools served as a unified Docker stack.
As of v2 the tools share **one Python backend** (FastAPI) and **one React
frontend** (Vite), behind an nginx auth proxy.

## Tools

- **TimePunch** (`/timepunch`) — time tracker: punch in/out, CSV import/export, weekly balance against a 42h target. Fully client-side (browser localStorage).
- **YTAudio** (`/ytaudio`) — download the audio track from any YouTube video; best original quality or MP3 320k / FLAC. Backed by `yt-dlp`.
- **ValueScope** (`/valuescope`) — enter a ticker (or search by company name) and get a color-coded value-investing dashboard with a composite 0–100 score. Backed by `yfinance`, no API key.

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
│   │   └── tools/      fetch.py · search.py (yfinance, spawned as subprocesses)
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
