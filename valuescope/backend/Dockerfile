FROM python:3.12-slim

# ValueScope's data tools are pure Python (yfinance over HTTP, IBKR Flex over
# stdlib urllib), so no system packages beyond CA certificates are needed.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Persistent data (the trade log) — the mount point must exist and be owned by
# the runtime user before USER drops privileges, because a named volume
# inherits the image's ownership on first mount.
ENV VS_DATA_DIR=/data
RUN mkdir -p /data

# Unprivileged runtime user
RUN useradd -r -s /usr/sbin/nologin app && chown -R app:app /app /data
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
