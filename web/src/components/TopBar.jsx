import { Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Button, Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

// Slim fixed app bar: back-to-home link (hidden on the landing page) + the
// dark/light toggle. Theme state is owned by App.
export default function TopBar({ mode, toggle }) {
  const { pathname } = useLocation();
  const atHome = pathname === '/';
  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Box>
          {!atHome && (
            <Button
              component={Link}
              to="/"
              color="inherit"
              size="small"
              startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
            >
              MicroProjects
            </Button>
          )}
        </Box>
        <IconButton onClick={toggle} color="inherit" title="Toggle light / dark">
          <FontAwesomeIcon icon={mode === 'light' ? faSun : faMoon} />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
