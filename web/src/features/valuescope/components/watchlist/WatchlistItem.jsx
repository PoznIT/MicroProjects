import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { assetKind } from '../../lib/assets.js';
import { fmtPosition } from '../../lib/watchlist.js';

// One symbol row inside a watchlist: asset-class icon, symbol/name, score chip,
// and a hover-revealed remove button. Clicking the row re-analyzes the symbol.
export default function WatchlistItem({ item, onSelect, onRemove }) {
  return (
    <Box
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
        {item.position && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>
            {fmtPosition(item.position)}
          </Typography>
        )}
      </Box>
      <Chip size="small" color={item.color} label={item.score ?? '…'} sx={{ minWidth: 44 }} />
      <IconButton
        className="rm" size="small"
        onClick={(e) => { e.stopPropagation(); onRemove(item.symbol); }}
        sx={{ opacity: 0, transition: 'opacity .15s' }}
      >
        <FontAwesomeIcon icon={faXmark} size="xs" />
      </IconButton>
    </Box>
  );
}
