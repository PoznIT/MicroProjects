import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

// The "new list" input row. Enter or the + button creates a list.
export default function CreateListBox({ newName, setNewName, onCreate }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1 }}>
      <TextField
        size="small" fullWidth placeholder="New list name…" value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
      />
      <Tooltip title="Create list">
        <IconButton size="small" color="primary" onClick={onCreate}>
          <FontAwesomeIcon icon={faPlus} size="sm" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
