import { useState, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, Button, ToggleButton, ToggleButtonGroup,
  CircularProgress, Alert, Stack, Avatar,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';

const FORMATS = [
  { value: 'best', label: 'Best', sub: 'original codec' },
  { value: 'mp3', label: 'MP3', sub: '320 kbps' },
  { value: 'flac', label: 'FLAC', sub: 'lossless' },
];

function fmtDuration(s) {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export default function YTAudio() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('best');
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState(null); // { severity, msg }
  const [busy, setBusy] = useState(false);
  const infoTimer = useRef(null);

  function onUrlChange(v) {
    setUrl(v);
    setMeta(null);
    clearTimeout(infoTimer.current);
    if (!v.trim()) return;
    infoTimer.current = setTimeout(() => fetchInfo(v.trim()), 500);
  }

  async function fetchInfo(u) {
    try {
      const r = await fetch('/api/ytaudio/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      if (!r.ok) return;
      setMeta(await r.json());
    } catch { /* non-fatal */ }
  }

  async function download() {
    const u = url.trim();
    if (!u) { setStatus({ severity: 'error', msg: 'Paste a YouTube URL first.' }); return; }
    setBusy(true);
    setStatus({ severity: 'info', msg: 'Fetching & converting — this can take a moment…' });
    try {
      const r = await fetch('/api/ytaudio/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, format }),
      });
      if (!r.ok) {
        let msg = 'Download failed.';
        try { msg = (await r.json()).error || msg; } catch { /* keep default */ }
        setStatus({ severity: 'error', msg });
        return;
      }
      const blob = await r.blob();
      const disp = r.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
      const name = match ? decodeURIComponent(match[1]) : 'audio';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setStatus({ severity: 'success', msg: 'Saved ' + name });
    } catch {
      setStatus({ severity: 'error', msg: 'Network error — please retry.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 12, px: 2, pb: 4 }}>
      <Typography variant="h4" fontWeight={700}>
        YT<Box component="span" sx={{ color: 'primary.main' }}>Audio</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        download the audio track from any YouTube video
      </Typography>

      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 560, p: 3 }}>
        <TextField
          fullWidth label="YouTube URL" type="url" autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url} onChange={e => onUrlChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') download(); }}
        />

        {meta && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            {meta.thumbnail && (
              <Avatar variant="rounded" src={meta.thumbnail} sx={{ width: 64, height: 48 }} />
            )}
            <Box>
              <Typography variant="body2">{meta.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[meta.uploader, fmtDuration(meta.duration)].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Stack>
        )}

        <ToggleButtonGroup
          fullWidth exclusive color="primary" value={format}
          onChange={(e, v) => { if (v) setFormat(v); }}
          sx={{ my: 3 }}
        >
          {FORMATS.map(f => (
            <ToggleButton key={f.value} value={f.value} sx={{ flexDirection: 'column', textTransform: 'none', py: 1 }}>
              <Typography variant="body2">{f.label}</Typography>
              <Typography variant="caption" color="text.secondary">{f.sub}</Typography>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Button
          fullWidth variant="contained" size="large" onClick={download} disabled={busy}
          startIcon={busy
            ? <CircularProgress size={18} color="inherit" />
            : <FontAwesomeIcon icon={faDownload} />}
        >
          Download audio
        </Button>

        {status && <Alert severity={status.severity} variant="outlined" sx={{ mt: 2 }}>{status.msg}</Alert>}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
