import { Link } from 'react-router-dom';
import './Home.css';

const TOOLS = [
  { to: '/timepunch',  icon: '⏱', name: 'TimePunch',
    desc: 'Track work hours with punch in/out. CSV import & export. Weekly balance against a 42h target.' },
  { to: '/ytaudio',    icon: '🎵', name: 'YTAudio',
    desc: 'Download the audio track from any YouTube video. Best original quality, or convert to MP3 320k / FLAC.' },
  { to: '/valuescope', icon: '📊', name: 'ValueScope',
    desc: 'Pull fundamentals for any ticker and get a color-coded value-investing read with a composite score.' },
];

export default function Home() {
  return (
    <div className="page">
      <div className="logo">Micro<span>Projects</span></div>
      <div className="tagline">a collection of small tools</div>

      <div className="grid">
        {TOOLS.map(t => (
          <Link key={t.to} className="card" to={t.to}>
            <div className="card-icon">{t.icon}</div>
            <div className="card-name">{t.name}</div>
            <div className="card-desc">{t.desc}</div>
          </Link>
        ))}
      </div>

      <footer className="footer">PoznIT / MicroProjects</footer>
    </div>
  );
}
