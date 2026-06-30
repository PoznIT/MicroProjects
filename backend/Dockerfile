FROM python:3.12-slim

# yt-dlp needs ffmpeg to convert audio and a JS runtime (deno) for current
# YouTube extraction; yfinance needs nothing beyond Python. curl/unzip fetch
# the yt-dlp + deno binaries.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
        -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && case "$(uname -m)" in \
        x86_64)  DENO_ARCH=x86_64-unknown-linux-gnu ;; \
        aarch64) DENO_ARCH=aarch64-unknown-linux-gnu ;; \
        *) echo "unsupported arch $(uname -m)" && exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-${DENO_ARCH}.zip" \
        -o /tmp/deno.zip \
 && unzip -q /tmp/deno.zip -d /usr/local/bin && rm /tmp/deno.zip \
 && chmod a+rx /usr/local/bin/deno

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Unprivileged runtime user
RUN useradd -r -s /usr/sbin/nologin app && chown -R app:app /app
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
