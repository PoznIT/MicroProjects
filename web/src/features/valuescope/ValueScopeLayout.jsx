import { Outlet, useNavigate } from 'react-router-dom';
import WatchlistPanel from './components/watchlist/WatchlistPanel.jsx';
import { useWatchlists } from './hooks/useWatchlists.js';
import { useAnalysis } from './hooks/useAnalysis.js';

// Shell for every ValueScope route: owns the one useWatchlists() instance (so
// the docked panel and its lists survive navigation) and the one useAnalysis()
// instance (the portfolio's search box feeds it; the position detail view
// triggers its analyze and renders the valuation section from it). Child
// routes get both through the router outlet context.
export default function ValueScopeLayout() {
  const watchlists = useWatchlists();
  const analysis = useAnalysis();
  const navigate = useNavigate();

  const openPosition = (symbol) =>
    navigate(`/valuescope/position/${encodeURIComponent(symbol.trim().toUpperCase())}`);

  return (
    <>
      <WatchlistPanel store={watchlists} current={analysis.data} onSelect={openPosition} />
      <Outlet context={{ watchlists, analysis, openPosition }} />
    </>
  );
}
