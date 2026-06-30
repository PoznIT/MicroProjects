const express = require('express');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const WORK_DIR = '/tmp/ytaudio';
fs.mkdirSync(WORK_DIR, { recursive: true });

// Only accept real YouTube URLs — never pass arbitrary strings to yt-dlp.
function isYouTubeUrl(value) {
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host);
}

// Per-format yt-dlp arguments. "best" keeps the original codec (no re-encode,
// highest fidelity); the others transcode with ffmpeg at max quality.
function formatArgs(format) {
  switch (format) {
    case 'mp3':
      return ['-x', '--audio-format', 'mp3', '--audio-quality', '0'];
    case 'flac':
      return ['-x', '--audio-format', 'flac'];
    case 'best':
    default:
      // bestaudio without -x: download the source audio stream untouched.
      return ['-f', 'bestaudio/best'];
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

// Lightweight metadata lookup for the UI (title / uploader / duration).
app.post('/api/info', async (req, res) => {
  const url = (req.body && req.body.url || '').trim();
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: 'Enter a valid YouTube URL.' });

  const { code, stdout, stderr } = await run('yt-dlp', [
    '--no-playlist', '--skip-download', '--dump-single-json', '--', url,
  ]);

  if (code !== 0) {
    console.error('info failed:', stderr.slice(-500));
    return res.status(502).json({ error: 'Could not read video info.' });
  }
  try {
    const j = JSON.parse(stdout);
    res.json({ title: j.title, uploader: j.uploader, duration: j.duration, thumbnail: j.thumbnail });
  } catch {
    res.status(502).json({ error: 'Could not parse video info.' });
  }
});

app.post('/api/download', async (req, res) => {
  const url = (req.body && req.body.url || '').trim();
  const format = (req.body && req.body.format || 'best').toLowerCase();
  if (!isYouTubeUrl(url)) return res.status(400).json({ error: 'Enter a valid YouTube URL.' });
  if (!['best', 'mp3', 'flac'].includes(format)) {
    return res.status(400).json({ error: 'Unknown format.' });
  }

  const job = crypto.randomBytes(8).toString('hex');
  const jobDir = path.join(WORK_DIR, job);
  fs.mkdirSync(jobDir, { recursive: true });

  const cleanup = () => fs.rm(jobDir, { recursive: true, force: true }, () => {});

  const args = [
    '--no-playlist',
    '--no-progress',
    '--restrict-filenames',
    ...formatArgs(format),
    '-o', path.join(jobDir, '%(title)s.%(ext)s'),
    '--', url,
  ];

  const { code, stderr } = await run('yt-dlp', args);
  if (code !== 0) {
    console.error('download failed:', stderr.slice(-800));
    cleanup();
    return res.status(502).json({ error: 'Download failed. The video may be unavailable.' });
  }

  const files = fs.readdirSync(jobDir);
  if (files.length === 0) {
    cleanup();
    return res.status(502).json({ error: 'No audio file produced.' });
  }

  const file = path.join(jobDir, files[0]);
  res.download(file, files[0], err => {
    if (err) console.error('send failed:', err.message);
    cleanup();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`YTAudio service listening on :${PORT}`));
