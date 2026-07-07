# CLAUDE.md

## Stack

**MicroProjects** — three tools (TimePunch `/timepunch`, YTAudio `/ytaudio`,
ValueScope `/valuescope`) on a shared stack behind an nginx auth proxy.

- **Backend** — FastAPI (Python 3.12), `backend/`. One router per tool under
  `/api/<tool>/…` (`backend/app/routers/`). Shared validation, injection guard,
  `{"error": …}` envelope, and subprocess runner live in `app/common.py`.
  External tools are spawned: `yt-dlp`, and `app/tools/{fetch,search,history}.py`
  (`yfinance`) plus `app/tools/ibkr.py` (IBKR Flex Web Service, stdlib-only;
  reads `IBKR_FLEX_TOKEN`/`IBKR_FLEX_QUERY_ID` from env). uvicorn :8000.
- **Frontend** — Vite + React, `web/`. App shell `src/App.jsx` (react-router);
  shared chrome (e.g. `TopBar`) in `src/components/`. One folder per tool in
  `src/features/<tool>/` with a `<Tool>.jsx` entry + `<Tool>.css`; as a tool
  grows, put presentational pieces in `components/`, state/fetching in `hooks/`,
  and pure logic (no React/MUI, so it stays testable/portable) in `lib/`. Theme
  tokens in `src/styles/theme.css` (`localStorage` key `mp-theme`). Built static,
  served by nginx (SPA fallback).
- **Auth** — `infra/auth/` (Node/Express): HMAC `mp_session` cookie, `/login`,
  `/logout`, `/verify`.
- **Gateway** — `infra/nginx/nginx.conf`: routes `/api/*` → api, else → web;
  protects all but `/login`, `/logout`.
- **Compose** — `auth`, `api`, `web`, `proxy`; app at `http://localhost:8080`.

Run: `cp .env.example .env` (set `MP_PASSWORD` + `MP_SECRET`), then
`docker compose up -d --build`.

## Working agreement

1. **Worktree per change**, never commit to `main`. Branch named
   `fix/<title>` or `feat/<title>` (short kebab-case):
   `git worktree add ../mp-feat-csv-export feat/csv-export`.
2. **Conventional Commits**: `<type>(<scope>): <summary>`. Types: `feat`, `fix`,
   `chore`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`. Scopes match the
   stack (`api`, `web`, `auth`, `nginx`, `valuescope`, `ytaudio`, `timepunch`).
3. **Done = pushed + PR/MR** opened against `main`:
   ```bash
   git push -u origin <branch>
   gh pr create --fill --base main            # or: glab mr create --fill --target-branch main
   ```
4. Claude must delete branches and worktrees that were previously merged
