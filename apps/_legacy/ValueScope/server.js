const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Tickers are short alphanumeric strings, optionally with a dot/dash suffix
// for share classes or exchanges (e.g. BRK.B, RDS-A, AIR.PA). Validate strictly
// so we never hand an arbitrary string to the spawned process.
function isValidTicker(value) {
  return typeof value === 'string' && /^[A-Za-z0-9.\-]{1,12}$/.test(value);
}

// Company-name queries are free text but kept to a safe, sane character set:
// letters, digits, spaces, and a few punctuation marks that appear in real
// company names (& . , - ' ). Everything is passed to spawn() as an argv
// element (no shell), but we validate anyway as defense in depth.
function isValidQuery(value) {
  return typeof value === 'string'
      && value.length >= 1 && value.length <= 64
      && /^[A-Za-z0-9 .,&'\-]+$/.test(value);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!isValidQuery(query)) {
    return res.status(400).json({ error: 'Enter a company name or ticker.' });
  }

  let result;
  try {
    result = await run('python3', [path.join(__dirname, 'search.py'), query]);
  } catch (e) {
    console.error('spawn failed:', e.message);
    return res.status(500).json({ error: 'Internal error launching search.' });
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch {
    console.error('search.py bad output:', result.stderr.slice(-500));
    return res.status(502).json({ error: 'Search is unavailable right now.' });
  }

  if (result.code !== 0 || payload.error) {
    return res.status(result.code === 0 ? 200 : 502)
              .json({ error: payload.error || 'Search failed.' });
  }

  res.json({ results: Array.isArray(payload.results) ? payload.results : [] });
});

app.get('/api/metrics', async (req, res) => {
  const symbol = (req.query.symbol || '').trim();
  if (!isValidTicker(symbol)) {
    return res.status(400).json({ error: 'Enter a valid ticker symbol (e.g. AAPL).' });
  }

  let result;
  try {
    result = await run('python3', [path.join(__dirname, 'fetch.py'), symbol]);
  } catch (e) {
    console.error('spawn failed:', e.message);
    return res.status(500).json({ error: 'Internal error launching the data fetcher.' });
  }

  // fetch.py always prints a JSON object (success or {"error": ...}).
  let payload;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch {
    console.error('fetch.py bad output:', result.stderr.slice(-500));
    return res.status(502).json({ error: 'Could not read data for that ticker.' });
  }

  if (result.code !== 0 || payload.error) {
    return res.status(result.code === 0 ? 200 : 404)
              .json({ error: payload.error || 'Could not fetch data.' });
  }

  res.json(payload);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ValueScope service listening on :${PORT}`));
