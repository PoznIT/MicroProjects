import { useState, useRef } from 'react';
import './YTAudio.css';

const FORMATS = [
  { value: 'best', label: 'Best', sub: 'original codec' },
  { value: 'mp3',  label: 'MP3',  sub: '320 kbps' },
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
  const [status, setStatus] = useState({ msg: '', cls: '' });
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
    if (!u) { setStatus({ msg: 'Paste a YouTube URL first.', cls: 'err' }); return; }
    setBusy(true);
    setStatus({ msg: 'Fetching & converting — this can take a moment…', cls: 'work' });
    try {
      const r = await fetch('/api/ytaudio/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, format }),
      });
      if (!r.ok) {
        let msg = 'Download failed.';
        try { msg = (await r.json()).error || msg; } catch { /* keep default */ }
        setStatus({ msg, cls: 'err' });
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
      setStatus({ msg: '✓ Saved ' + name, cls: 'ok' });
    } catch {
      setStatus({ msg: 'Network error — please retry.', cls: 'err' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="logo">YT<span>Audio</span></div>
      <div className="tagline">download the audio track from any YouTube video</div>

      <div className="panel">
        <label htmlFor="yt-url">YouTube URL</label>
        <input id="yt-url" type="url" autoComplete="off" spellCheck="false"
               placeholder="https://www.youtube.com/watch?v=…"
               value={url} onChange={e => onUrlChange(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') download(); }} />

        {meta && (
          <div className="meta">
            {meta.thumbnail && <img src={meta.thumbnail} alt="" />}
            <div>
              <div className="t">{meta.title}</div>
              <div className="u">{[meta.uploader, fmtDuration(meta.duration)].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        )}

        <div className="formats">
          {FORMATS.map(f => (
            <label key={f.value} className={format === f.value ? 'sel' : ''}>
              <input type="radio" name="format" value={f.value}
                     checked={format === f.value} onChange={() => setFormat(f.value)} />
              <span>{f.label}</span><small>{f.sub}</small>
            </label>
          ))}
        </div>

        <button className="btn-go" onClick={download} disabled={busy}>Download audio</button>
        <div className={'status ' + status.cls}>
          {busy && <span className="spinner" />}{status.msg}
        </div>
      </div>

      <footer className="footer">PoznIT / MicroProjects</footer>
    </div>
  );
}
