import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Card, CardActionArea, CardContent } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faMusic } from '@fortawesome/free-solid-svg-icons';

const TOOLS = [
  { to: '/timepunch', icon: faClock, name: 'TimePunch',
    desc: 'Track work hours with punch in/out. CSV import & export. Weekly balance against a 42h target.' },
  { to: '/ytaudio', icon: faMusic, name: 'YTAudio',
    desc: 'Download the audio track from any YouTube video. Best original quality, or convert to MP3 320k / FLAC.' },
];

export default function Home() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 12, px: 2, pb: 4 }}>
      <Typography variant="h4" fontWeight={700}>
        Micro<Box component="span" sx={{ color: 'primary.main' }}>Projects</Box>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        a collection of small tools
      </Typography>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
        gap: 2, width: '100%', maxWidth: 820,
      }}>
        {TOOLS.map(t => (
          <Card key={t.to} variant="outlined" sx={{ height: '100%' }}>
            <CardActionArea component={RouterLink} to={t.to} sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ color: 'primary.main', mb: 1.5 }}>
                  <FontAwesomeIcon icon={t.icon} size="2x" />
                </Box>
                <Typography variant="h6" gutterBottom>{t.name}</Typography>
                <Typography variant="body2" color="text.secondary">{t.desc}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 6 }}>
        PoznIT / MicroProjects
      </Typography>
    </Box>
  );
}
