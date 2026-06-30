FROM node:20-slim

# yt-dlp needs python3 + ffmpeg to extract/convert audio, and a JavaScript
# runtime (deno) for current YouTube extraction. curl/unzip fetch the binaries.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 ffmpeg ca-certificates curl unzip \
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
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public

# Unprivileged runtime user; scratch dir for in-flight downloads
RUN mkdir -p /tmp/ytaudio && useradd -r -s /usr/sbin/nologin app \
 && chown -R app:app /app /tmp/ytaudio
USER app

EXPOSE 3000
CMD ["node", "server.js"]
