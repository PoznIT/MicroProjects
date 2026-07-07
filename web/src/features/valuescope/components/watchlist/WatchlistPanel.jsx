import { Box, Paper, Typography, Collapse, Divider } from '@mui/material';
import { saveSession } from '../../lib/session.js';
import { useWatchlists } from '../../hooks/useWatchlists.js';
import WatchlistRail from './WatchlistRail.jsx';
import WatchlistToolbar from './WatchlistToolbar.jsx';
import CreateListBox from './CreateListBox.jsx';
import WatchlistCard from './WatchlistCard.jsx';
import ListMenu from './ListMenu.jsx';

// Docked full-height pane on the left, just below the fixed app bar. Owns the
// watchlist state via useWatchlists and composes the rail, toolbar, create box,
// list cards and the per-list actions menu. `current` is the symbol being
// analyzed (add target); onSelect re-analyzes a clicked entry.
const APPBAR = 48; // dense MUI Toolbar height

export default function WatchlistPanel({ current, onSelect }) {
  const {
    lists, panelOpen, setPanelOpen, refreshing, totalItems,
    newName, setNewName, notice, setNotice, editing, setEditing, menu, setMenu,
    createList, deleteList, toggleList, commitRename, moveList, setSort,
    removeItem, addCurrent, refreshAll, loadSession,
  } = useWatchlists();

  return (
    <Box sx={{
      position: 'fixed', top: APPBAR, left: 0, height: `calc(100dvh - ${APPBAR}px)`,
      zIndex: 1000, display: 'flex', flexDirection: 'row-reverse', alignItems: 'stretch',
    }}>
      <WatchlistRail panelOpen={panelOpen} totalItems={totalItems} onToggle={() => setPanelOpen(o => !o)} />

      <Collapse orientation="horizontal" in={panelOpen} sx={{ height: '100%' }}>
        <Paper
          square variant="outlined"
          sx={{ width: 320, height: '100%', display: 'flex', flexDirection: 'column',
                borderTop: 0, borderLeft: 0, borderBottom: 0 }}
        >
          <WatchlistToolbar
            totalItems={totalItems}
            refreshing={refreshing}
            onRefresh={refreshAll}
            onSave={() => saveSession(lists)}
            onLoadFile={loadSession}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
          />
          <Divider />

          <CreateListBox newName={newName} setNewName={setNewName} onCreate={createList} />
          <Divider />

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {lists.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 2, textAlign: 'center' }}>
                Create a list, then add the symbol you're analyzing to start tracking it.
              </Typography>
            )}

            {lists.map(list => (
              <WatchlistCard
                key={list.id}
                list={list}
                current={current}
                editing={editing}
                setEditing={setEditing}
                onToggle={toggleList}
                onCommitRename={commitRename}
                onAddCurrent={addCurrent}
                onRemoveItem={removeItem}
                onSelect={onSelect}
                onOpenMenu={(anchorEl, id) => setMenu({ anchorEl, id })}
              />
            ))}
          </Box>

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
