import { useRef } from 'react';
import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faFloppyDisk, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

// Panel header: title plus refresh / save / load actions and the (dismissable)
// status notice. The hidden file input is owned here and driven by the load
// button; picking a file calls onLoadFile.
export default function WatchlistToolbar({
  totalItems, refreshing, onRefresh, onSave, onLoadFile, notice, onDismissNotice,
}) {
  const fileRef = useRef(null);
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>Watchlists</Typography>
        <Tooltip title={totalItems ? 'Refresh all values' : 'Nothing to refresh yet'}>
          <span>
            <IconButton size="small" onClick={onRefresh} disabled={refreshing || !totalItems}>
              {refreshing
                ? <CircularProgress size={16} color="inherit" />
                : <FontAwesomeIcon icon={faRotate} size="sm" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={totalItems ? 'Save watchlists to a file' : 'Nothing to save yet'}>
          <span>
            <IconButton size="small" onClick={onSave} disabled={!totalItems}>
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
          hidden onChange={onLoadFile}
        />
      </Box>
      {notice && (
        <Typography
          variant="caption" onClick={onDismissNotice}
          sx={{ display: 'block', px: 1.5, pb: 1, cursor: 'pointer',
                color: notice.error ? 'error.main' : 'success.main' }}
        >
          {notice.text}
        </Typography>
      )}
    </>
  );
}
