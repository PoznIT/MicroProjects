import { Link, useLocation } from 'react-router-dom';

// Fixed top bar: a back-home link (hidden on the landing page) plus the
// dark/light toggle. Theme state is owned by App and passed down.
export default function TopBar({ theme, toggle }) {
  const { pathname } = useLocation();
  const atHome = pathname === '/';
  return (
    <div className="appbar">
      <div>{atHome ? <span /> : <Link to="/">← MicroProjects</Link>}</div>
      <button className="btn-ghost" onClick={toggle} title="Toggle light/dark">
        {theme === 'light' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
