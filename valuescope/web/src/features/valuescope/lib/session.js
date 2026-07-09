// Save / load a ValueScope "session" — the watchlists that make up a user's
// dashboard — as a small YAML file that can be handed to someone else. Only the
// identity of each holding is stored (list names + symbols); the score, verdict
// and colour are regenerated from live metrics when the file is loaded.
import YAML from 'yaml';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Reduce the in-app watchlist shape to the minimal, shareable form.
function toSaved(lists) {
  return {
    tool: 'ValueScope',
    version: 1,
    saved: new Date().toISOString(),
    watchlists: lists.map((l) => ({
      name: l.name,
      sortKey: l.sortKey ?? null,
      sortDir: l.sortDir ?? 'asc',
      items: l.items.map((i) => ({
        symbol: i.symbol,
        name: i.name ?? null,
      })),
    })),
  };
}

export function saveSession(lists) {
  const yaml = YAML.stringify(toSaved(lists));
  const blob = new Blob([yaml], { type: 'application/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'valuescope-watchlists.yaml';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Parse a saved file back into ready-to-use watchlists (fresh ids, expanded).
// Throws on anything that isn't a recognizable ValueScope session.
export function parseSession(text) {
  let doc;
  try {
    doc = YAML.parse(text);
  } catch {
    throw new Error('not valid YAML.');
  }
  if (!doc || !Array.isArray(doc.watchlists)) {
    throw new Error('not a ValueScope watchlists file.');
  }
  return doc.watchlists
    .filter((l) => l && typeof l === 'object')
    .map((l, idx) => ({
      id: newId(),
      name: typeof l.name === 'string' && l.name.trim() ? l.name : `Watchlist ${idx + 1}`,
      open: true,
      sortKey: ['score', 'symbol', 'name'].includes(l.sortKey) ? l.sortKey : null,
      sortDir: l.sortDir === 'desc' ? 'desc' : 'asc',
      items: (Array.isArray(l.items) ? l.items : [])
        .filter((i) => i && typeof i.symbol === 'string' && i.symbol.trim())
        .map((i) => ({
          symbol: i.symbol,
          name: typeof i.name === 'string' ? i.name : '',
          // score/verdict/colour are (re)generated from live metrics on load.
          score: null,
          verdict: null,
          color: 'default',
        })),
    }));
}
