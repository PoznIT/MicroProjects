import { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, Typography, IconButton, Collapse, Chip, Stack,
  TextField, Tooltip, CircularProgress, Divider,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faChevronRight, faChevronLeft, faRotate, faPlus, faTrashCan,
  faXmark, faListUl, faFloppyDisk, faFolderOpen,
  faEllipsisVertical, faPen, faArrowUp, faArrowDown, faCheck, faArrowsUpDown,
} from '@fortawesome/free-solid-svg-icons';
import { saveSession, parseSession } from './lib/session.js';
import { assetKind } from './lib/assets.js';
import {
  SORTS, sortedItems, loadLists, newId, toItem, LS_LISTS, LS_PANEL,
} from './lib/watchlist.js';

export default function Watchlist({ current, onSelect }) {
  const [lists, setLists] = useState(loadLists);
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(LS_PANEL) !== 'false');
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState(null); // { error, text }
  const [editing, setEditing] = useState(null); // { id, name } while renaming a list
  const [menu, setMenu] = useState(null);       // { anchorEl, id } for a list's actions menu
  const fileRef = useRef(null);

  useEffect(() => { localStorage.setItem(LS_LISTS, JSON.stringify(lists)); }, [lists]);
  useEffect(() => { localStorage.setItem(LS_PANEL, String(panelOpen)); }, [panelOpen]);

  const totalItems = lists.reduce((n, l) => n + l.items.length, 0);

  function createList() {
    const name = newName.trim() || `Watchlist ${lists.length + 1}`;
    setLists(ls => [...ls, { id: newId(), name, open: true, sortKey: null, sortDir: 'asc', items: [] }]);
    setNewName('');
  }

  const deleteList = (id) => setLists(ls => ls.filter(l => l.id !== id));
  const toggleList = (id) => setLists(ls => ls.map(l => l.id === id ? { ...l, open: !l.open } : l));

  const renameList = (id, name) => setLists(ls => ls.map(l => l.id === id ? { ...l, name } : l));

  function commitRename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (name) renameList(editing.id, name);
    setEditing(null);
  }

  // Swap a list with its neighbour to move it up (-1) or down (+1) in the panel.
  function moveList(id, dir) {
    setLists(ls => {
      const i = ls.findIndex(l => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Pick the field to sort a list's entries by; re-picking the active field
  // flips direction, and null restores the original "as added" order.
  function setSort(id, key) {
    setLists(ls => ls.map(l => {
      if (l.id !== id) return l;
      if (key === null) return { ...l, sortKey: null };
      if (l.sortKey === key) return { ...l, sortDir: l.sortDir === 'asc' ? 'desc' : 'asc' };
      return { ...l, sortKey: key, sortDir: key === 'score' ? 'desc' : 'asc' };
    }));
  }
  const removeItem = (id, symbol) =>
    setLists(ls => ls.map(l => l.id === id ? { ...l, items: l.items.filter(i => i.symbol !== symbol) } : l));

  function addCurrent(id) {
    if (!current) return;
    const item = toItem(current);
    setLists(ls => ls.map(l => {
      if (l.id !== id || l.items.some(i => i.symbol === item.symbol)) return l;
      return { ...l, items: [...l.items, item] };
    }));
  }

  // Fetch live metrics for a set of symbols and score them into watchlist items.
  async function fetchItems(symbols) {
    const out = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const r = await fetch('/api/valuescope/metrics?symbol=' + encodeURIComponent(sym));
        const j = await r.json();
        if (r.ok && !j.error) out[sym] = toItem(j);
      } catch { /* leave the existing value in place */ }
    }));
    return out;
  }

  const applyItems = (updated) => setLists(ls => ls.map(l => ({
    ...l,
    items: l.items.map(it => updated[it.symbol] ? { ...it, ...updated[it.symbol] } : it),
  })));

  async function refreshAll() {
    const symbols = [...new Set(lists.flatMap(l => l.items.map(i => i.symbol)))];
    if (!symbols.length || refreshing) return;
    setRefreshing(true);
    applyItems(await fetchItems(symbols));
    setRefreshing(false);
  }

  async function loadSession(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                 // allow re-loading the same file
    if (!file) return;
    try {
      const loaded = parseSession(await file.text());
      setLists(ls => [...ls, ...loaded]);
      const symbols = [...new Set(loaded.flatMap(l => l.items.map(i => i.symbol)))];
      setNotice({ error: false, text:
        `Loaded ${loaded.length} list(s), ${symbols.length} symbol(s)${symbols.length ? ' — scoring…' : ''}` });
      if (symbols.length) {
        setRefreshing(true);
        applyItems(await fetchItems(symbols));
        setRefreshing(false);
        setNotice({ error: false, text: `Loaded ${loaded.length} list(s), ${symbols.length} symbol(s).` });
      }
    } catch (err) {
      setNotice({ error: true, text: 'Could not load — ' + (err.message || 'invalid file.') });
    }
  }

  // Docked full-height pane on the right, just below the fixed app bar.
  const APPBAR = 48; // dense MUI Toolbar height

  return (
    <Box sx={{
      position: 'fixed', top: APPBAR, left: 0, height: `calc(100dvh - ${APPBAR}px)`,
      zIndex: 1000, display: 'flex', flexDirection: 'row-reverse', alignItems: 'stretch',
    }}>
      {/* Rail handle — always docked to the edge; toggles the pane open/closed */}
      <Box
        onClick={() => setPanelOpen(o => !o)}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          py: 1.5, px: 0.25, cursor: 'pointer', bgcolor: 'background.paper',
          borderRight: 1, borderColor: 'divider',
        }}
      >
        <Tooltip title={panelOpen ? 'Collapse watchlists' : 'Open watchlists'} placement="right">
          <IconButton size="small">
            <FontAwesomeIcon icon={panelOpen ? faChevronLeft : faChevronRight} size="sm" />
          </IconButton>
        </Tooltip>
        <FontAwesomeIcon icon={faListUl} />
        {totalItems > 0 && <Chip size="small" label={totalItems} sx={{ height: 18, fontSize: 11 }} />}
        {!panelOpen && (
          <Typography
            variant="caption" color="text.secondary"
            sx={{ writingMode: 'vertical-rl', letterSpacing: '.12em', mt: 0.5 }}
          >
            WATCHLISTS
          </Typography>
        )}
      </Box>

      {/* Sliding pane */}
      <Collapse orientation="horizontal" in={panelOpen} sx={{ height: '100%' }}>
        <Paper
          square variant="outlined"
          sx={{ width: 320, height: '100%', display: 'flex', flexDirection: 'column',
                borderTop: 0, borderLeft: 0, borderBottom: 0 }}
        >
      {/* Panel header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>Watchlists</Typography>
        <Tooltip title={totalItems ? 'Refresh all values' : 'Nothing to refresh yet'}>
          <span>
            <IconButton size="small" onClick={refreshAll} disabled={refreshing || !totalItems}>
              {refreshing
                ? <CircularProgress size={16} color="inherit" />
                : <FontAwesomeIcon icon={faRotate} size="sm" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={totalItems ? 'Save watchlists to a file' : 'Nothing to save yet'}>
          <span>
            <IconButton size="small" onClick={() => saveSession(lists)} disabled={!totalItems}>
              <FontAwesomeIcon icon={faFloppyDisk} size="sm" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Load watchlists from a file">
          <IconButton size="small" onClick={() => fileRef.current?.click()}>
            <FontAwesomeIcon icon={faFolderOpen} size="sm" />
          </IconButton>
        </Tooltip>
        <input
          ref={fileRef} type="file" accept=".yaml,.yml,application/yaml,text/yaml"
          hidden onChange={loadSession}
        />
      </Box>
      {notice && (
        <Typography
          variant="caption" onClick={() => setNotice(null)}
          sx={{ display: 'block', px: 1.5, pb: 1, cursor: 'pointer',
                color: notice.error ? 'error.main' : 'success.main' }}
        >
          {notice.text}
        </Typography>
      )}
      <Divider />

      {/* Create a new list */}
      <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1 }}>
        <TextField
          size="small" fullWidth placeholder="New list name…" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createList(); }}
        />
        <Tooltip title="Create list">
          <IconButton size="small" color="primary" onClick={createList}>
            <FontAwesomeIcon icon={faPlus} size="sm" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* Lists */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {lists.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 2, textAlign: 'center' }}>
            Create a list, then add the symbol you're analyzing to start tracking it.
          </Typography>
        )}

        {lists.map((list, idx) => {
          const inList = current && list.items.some(i => i.symbol === current.symbol);
          const editingThis = editing?.id === list.id;
          return (
            <Box key={list.id}>
              {/* List header — click to collapse vertically */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75 }}>
                <IconButton size="small" onClick={() => toggleList(list.id)}>
                  <FontAwesomeIcon icon={list.open ? faChevronDown : faChevronRight} size="xs" />
                </IconButton>
                {editingThis ? (
                  <TextField
                    size="small" variant="standard" autoFocus fullWidth
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    sx={{ flex: 1 }}
                  />
                ) : (
                  <Typography
                    variant="body2" fontWeight={600} noWrap
                    sx={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleList(list.id)}
                    onDoubleClick={() => setEditing({ id: list.id, name: list.name })}
                  >
                    {list.name}
                  </Typography>
                )}
                {list.sortKey && (
                  <Tooltip title={`Sorted by ${SORTS[list.sortKey].label} (${list.sortDir})`}>
                    <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>
                      <FontAwesomeIcon icon={list.sortDir === 'desc' ? faArrowDown : faArrowUp} size="xs" />
                    </Box>
                  </Tooltip>
                )}
                <Typography variant="caption" color="text.secondary">{list.items.length}</Typography>
                <Tooltip title={
                  !current ? 'Analyze a symbol to add it'
                    : inList ? `${current.symbol} already in this list`
                    : `Add ${current.symbol}`
                }>
                  <span>
                    <IconButton size="small" color="primary"
                      onClick={() => addCurrent(list.id)} disabled={!current || inList}>
                      <FontAwesomeIcon icon={faPlus} size="xs" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="List actions">
                  <IconButton size="small" onClick={(e) => setMenu({ anchorEl: e.currentTarget, id: list.id })}>
                    <FontAwesomeIcon icon={faEllipsisVertical} size="xs" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Collapse in={list.open} unmountOnExit>
                {list.items.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pb: 1 }}>
                    Empty — add a symbol with the + above.
                  </Typography>
                ) : (
                  <Stack sx={{ pb: 0.5 }}>
                    {sortedItems(list).map(item => (
                      <Box
                        key={item.symbol}
                        onClick={() => onSelect?.(item.symbol)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:hover .rm': { opacity: 1 },
                        }}
                      >
                        <Tooltip title={assetKind(item.type).title} placement="left">
                          <Box component="span" sx={{ width: 16, textAlign: 'center', color: 'text.secondary', flexShrink: 0 }}>
                            <FontAwesomeIcon icon={assetKind(item.type).icon} size="sm" />
                          </Box>
                        </Tooltip>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} lineHeight={1.2}>{item.symbol}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {item.name}
                          </Typography>
                        </Box>
                        <Chip size="small" color={item.color} label={item.score ?? '…'} sx={{ minWidth: 44 }} />
                        <IconButton
                          className="rm" size="small"
                          onClick={(e) => { e.stopPropagation(); removeItem(list.id, item.symbol); }}
                          sx={{ opacity: 0, transition: 'opacity .15s' }}
                        >
                          <FontAwesomeIcon icon={faXmark} size="xs" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Collapse>
              <Divider />
            </Box>
          );
        })}
      </Box>

      {/* Per-list actions: rename, reorder the list, and sort its entries */}
      <ListMenu
        menu={menu}
        lists={lists}
        onClose={() => setMenu(null)}
        onRename={(id, name) => setEditing({ id, name })}
        onMove={moveList}
        onSort={setSort}
        onDelete={deleteList}
      />
        </Paper>
      </Collapse>
    </Box>
  );
}

// Actions menu for a single watchlist. Kept separate so the header row stays
// uncluttered; it resolves the target list from `menu.id` each render.
function ListMenu({ menu, lists, onClose, onRename, onMove, onSort, onDelete }) {
  const list = menu && lists.find(l => l.id === menu.id);
  const idx = list ? lists.findIndex(l => l.id === list.id) : -1;
  const after = (fn) => () => { fn(); onClose(); };
  return (
    <Menu
      anchorEl={menu?.anchorEl}
      open={Boolean(menu) && Boolean(list)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={after(() => onRename(list.id, list.name))}>
        <ListItemIcon><FontAwesomeIcon icon={faPen} /></ListItemIcon>
        <ListItemText>Rename</ListItemText>
      </MenuItem>
      <MenuItem disabled={idx <= 0} onClick={after(() => onMove(list.id, -1))}>
        <ListItemIcon><FontAwesomeIcon icon={faArrowUp} /></ListItemIcon>
        <ListItemText>Move up</ListItemText>
      </MenuItem>
      <MenuItem disabled={idx < 0 || idx >= lists.length - 1} onClick={after(() => onMove(list.id, 1))}>
        <ListItemIcon><FontAwesomeIcon icon={faArrowDown} /></ListItemIcon>
        <ListItemText>Move down</ListItemText>
      </MenuItem>
      <Divider />
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
        Sort entries by
      </Typography>
      {Object.entries(SORTS).map(([key, { label }]) => {
        const active = list?.sortKey === key;
        return (
          <MenuItem key={key} onClick={() => onSort(list.id, key)}>
            <ListItemIcon>
              {active
                ? <FontAwesomeIcon icon={list.sortDir === 'desc' ? faArrowDown : faArrowUp} />
                : <FontAwesomeIcon icon={faArrowsUpDown} style={{ opacity: 0.35 }} />}
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        );
      })}
      <MenuItem onClick={after(() => onSort(list.id, null))}>
        <ListItemIcon>{!list?.sortKey && <FontAwesomeIcon icon={faCheck} />}</ListItemIcon>
        <ListItemText>Manual (as added)</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={after(() => onDelete(list.id))} sx={{ color: 'error.main' }}>
        <ListItemIcon sx={{ color: 'error.main' }}><FontAwesomeIcon icon={faTrashCan} /></ListItemIcon>
        <ListItemText>Delete list</ListItemText>
      </MenuItem>
    </Menu>
  );
}
