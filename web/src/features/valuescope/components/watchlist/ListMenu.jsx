import { Menu, MenuItem, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrashCan, faPen, faArrowUp, faArrowDown, faCheck, faArrowsUpDown,
} from '@fortawesome/free-solid-svg-icons';
import { SORTS } from '../../lib/watchlist.js';

// Actions menu for a single watchlist. Kept separate so the header row stays
// uncluttered; it resolves the target list from `menu.id` each render.
export default function ListMenu({ menu, lists, onClose, onRename, onMove, onSort, onDelete }) {
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
