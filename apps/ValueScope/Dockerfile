FROM node:20-slim

# yfinance (Python) reads Yahoo Finance's public endpoints — no API key needed.
# Install python3 + pip and the yfinance package; node runs the web layer.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --no-cache-dir --break-system-packages yfinance

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js fetch.py search.py ./
COPY public ./public

# Unprivileged runtime user
RUN useradd -r -s /usr/sbin/nologin app && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "server.js"]
