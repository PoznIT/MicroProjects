import { Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Button, Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

// Slim fixed app bar: the ValueScope wordmark (links home) + the dark/light
// toggle. Theme state is owned by App.
export default function TopBar({ mode, toggle }) {
  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Button
            component={RouterLink}
            to="/valuescope"
            color="inherit"
            size="small"
            startIcon={<FontAwesomeIcon icon={faChartColumn} />}
          >
            ValueScope
          </Button>
        </Box>
        <IconButton onClick={toggle} color="inherit" title="Toggle light / dark">
          <FontAwesomeIcon icon={mode === 'light' ? faSun : faMoon} />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
