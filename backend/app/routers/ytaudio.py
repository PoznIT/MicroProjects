"""YTAudio: extract the audio track from a YouTube URL via yt-dlp.

Ported from the original Express service — same URL allow-list, same per-format
yt-dlp arguments, same temp-dir-per-job + cleanup approach.
"""

import os
import shutil
import tempfile
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..common import api_error, run

router = APIRouter(prefix="/api/ytaudio", tags=["ytaudio"])

_ALLOWED_HOSTS = {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
_FORMATS = {"best", "mp3", "flac"}


class InfoReq(BaseModel):
    url: str


class DownloadReq(BaseModel):
    url: str
    format: str = "best"


def _is_youtube_url(value: str) -> bool:
    """Only accept real YouTube URLs — never pass arbitrary strings to yt-dlp."""
    try:
        u = urlparse(value)
    except (ValueError, AttributeError):
        return False
    if u.scheme not in ("http", "https"):
        return False
    host = (u.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host in _ALLOWED_HOSTS


def _format_args(fmt: str):
    if fmt == "mp3":
        return ["-x", "--audio-format", "mp3", "--audio-quality", "0"]
    if fmt == "flac":
        return ["-x", "--audio-format", "flac"]
    return ["-f", "bestaudio/best"]  # best: source audio untouched


@router.post("/info")
async def info(req: InfoReq):
    url = (req.url or "").strip()
    if not _is_youtube_url(url):
        raise api_error(400, "Enter a valid YouTube URL.")

    code, stdout, _ = await run(
        "yt-dlp", "--no-playlist", "--skip-download", "--dump-single-json", "--", url,
        timeout=60,
    )
    if code != 0:
        raise api_error(502, "Could not read video info.")
    try:
        import json
        j = json.loads(stdout)
    except (ValueError, json.JSONDecodeError):
        raise api_error(502, "Could not parse video info.")
    return {
        "title": j.get("title"),
        "uploader": j.get("uploader"),
        "duration": j.get("duration"),
        "thumbnail": j.get("thumbnail"),
    }


@router.post("/download")
async def download(req: DownloadReq, background: BackgroundTasks):
    url = (req.url or "").strip()
    fmt = (req.format or "best").lower()
    if not _is_youtube_url(url):
        raise api_error(400, "Enter a valid YouTube URL.")
    if fmt not in _FORMATS:
        raise api_error(400, "Unknown format.")

    job_dir = tempfile.mkdtemp(prefix="ytaudio_")

    def cleanup():
        shutil.rmtree(job_dir, ignore_errors=True)

    args = [
        "--no-playlist", "--no-progress", "--restrict-filenames",
        *_format_args(fmt),
        "-o", os.path.join(job_dir, "%(title)s.%(ext)s"),
        "--", url,
    ]
    code, _, _ = await run("yt-dlp", *args, timeout=300)
    if code != 0:
        cleanup()
        raise api_error(502, "Download failed. The video may be unavailable.")

    files = os.listdir(job_dir)
    if not files:
        cleanup()
        raise api_error(502, "No audio file produced.")

    path = os.path.join(job_dir, files[0])
    background.add_task(cleanup)
    return FileResponse(path, filename=files[0], background=background)
