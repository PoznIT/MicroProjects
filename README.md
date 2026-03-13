# MicroProjects

A collection of small, focused utility tools served as a unified Docker stack.

## Projects

### [TimePunch](apps/TimePunch/)

A lightweight time tracking app for logging work hours. Punch in/out interface with CSV import/export and weekly balance tracking.

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

The stack runs two containers:

- **proxy** — nginx serving all static files and enforcing auth
- **auth** — Node.js service handling login/logout and session validation

## Architecture

```text
/
├── apps/
│   └── TimePunch/      TimePunch app
├── infra/
│   ├── auth/           Node.js auth service (login page, session cookies)
│   └── nginx/          nginx config
├── portal/
│   ├── index.html      Landing page
│   └── shared/
│       ├── theme.css   Design tokens (dark/light), fonts, CSS reset
│       └── theme.js    Theme toggle — persists via localStorage (key: mp-theme)
└── docker-compose.yml
```

All routes except `/login`, `/logout`, and `/shared/` are protected by an nginx `auth_request` check. Sessions are HMAC-signed cookies valid for 7 days.

## Adding a new project

1. Create a folder under `apps/` (e.g. `apps/MyApp/`)

2. Link the shared theme in the app's HTML:

   ```html
   <link rel="stylesheet" href="/shared/theme.css">
   <script src="/shared/theme.js"></script>
   <script>initTheme();</script>
   ```

3. Add a nginx location block in `infra/nginx/nginx.conf`:

   ```nginx
   location /myapp/ {
       auth_request /verify;
       error_page 401 = @require_login;
       alias /var/www/apps/MyApp/;
       index index.html;
       try_files $uri $uri/ index.html;
   }
   ```

4. Add a volume mount in `docker-compose.yml`:

   ```yaml
   - ./apps/MyApp:/var/www/apps/MyApp:ro
   ```

5. Add a card to `portal/index.html`

6. Restart: `docker compose restart proxy`

## License

[MIT](LICENSE)
