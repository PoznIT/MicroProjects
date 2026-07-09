const express      = require('express');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const path         = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const SECRET      = process.env.MP_SECRET   || (() => { throw new Error('MP_SECRET is required'); })();
const PASSWORD    = process.env.MP_PASSWORD || (() => { throw new Error('MP_PASSWORD is required'); })();
const COOKIE_NAME = 'mp_session';
const MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Token helpers ──────────────────────────────────────────────────────────

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function makeToken() {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const valid   = crypto.timingSafeEqual(
    Buffer.from(sign(payload)),
    Buffer.from(sig)
  );
  return valid && Date.now() < parseInt(payload, 10);
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Called internally by nginx auth_request
app.get('/verify', (req, res) => {
  verifyToken(req.cookies[COOKIE_NAME]) ? res.sendStatus(200) : res.sendStatus(401);
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login form submit
app.post('/login', (req, res) => {
  const given  = Buffer.from(req.body.password  || '');
  const expect = Buffer.from(PASSWORD);
  const match  = given.length === expect.length &&
                 crypto.timingSafeEqual(given, expect);

  if (match) {
    res.cookie(COOKIE_NAME, makeToken(), { httpOnly: true, sameSite: 'Lax', maxAge: MAX_AGE_MS });
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/login');
});

app.listen(3000, () => console.log('Auth service listening on :3000'));
