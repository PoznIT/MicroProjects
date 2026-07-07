import { Box, Typography, IconButton, Collapse, Stack, TextField, Tooltip, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faChevronRight, faPlus, faEllipsisVertical, faArrowUp, faArrowDown,
} from '@fortawesome/free-solid-svg-icons';
import { SORTS, sortedItems } from '../../lib/watchlist.js';
import WatchlistItem from './WatchlistItem.jsx';

// A single watchlist: header (collapse toggle, name / inline rename, sort badge,
// entry count, add-current, actions menu) and its (sorted) entries. All state
// mutation flows through callbacks provided by the panel.
export default function WatchlistCard({
  list, current, editing, setEditing, onToggle, onCommitRename,
  onAddCurrent, onRemoveItem, onSelect, onOpenMenu,
}) {
  const inList = current && list.items.some(i => i.symbol === current.symbol);
  const editingThis = editing?.id === list.id;

  return (
    <Box>
      {/* List header — click to collapse vertically */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75 }}>
        <IconButton size="small" onClick={() => onToggle(list.id)}>
          <FontAwesomeIcon icon={list.open ? faChevronDown : faChevronRight} size="xs" />
        </IconButton>
        {editingThis ? (
          <TextField
            size="small" variant="standard" autoFocus fullWidth
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') setEditing(null);
            }}
            sx={{ flex: 1 }}
          />
        ) : (
          <Typography
            variant="body2" fontWeight={600} noWrap
            sx={{ flex: 1, cursor: 'pointer' }} onClick={() => onToggle(list.id)}
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
              onClick={() => onAddCurrent(list.id, current)} disabled={!current || inList}>
              <FontAwesomeIcon icon={faPlus} size="xs" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="List actions">
          <IconButton size="small" onClick={(e) => onOpenMenu(e.currentTarget, list.id)}>
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
              <WatchlistItem
                key={item.symbol}
                item={item}
                onSelect={onSelect}
                onRemove={(symbol) => onRemoveItem(list.id, symbol)}
              />
            ))}
          </Stack>
        )}
      </Collapse>
      <Divider />
    </Box>
  );
}
