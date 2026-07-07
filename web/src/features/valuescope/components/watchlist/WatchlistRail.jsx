import { Box, Typography, IconButton, Chip, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faListUl } from '@fortawesome/free-solid-svg-icons';

// The always-docked edge handle that opens/closes the sliding pane. Shows the
// total-entry count and, when collapsed, a vertical "WATCHLISTS" label.
export default function WatchlistRail({ panelOpen, totalItems, onToggle }) {
  return (
    <Box
      onClick={onToggle}
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
  );
}
