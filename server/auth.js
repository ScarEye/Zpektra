import crypto from 'node:crypto';

const SPOTIFY_AUTH = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const pendingStates = new Set();

function basicAuthHeader() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

export function registerAuthRoutes(app) {

  app.get('/auth/login', (_req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.add(state);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID || '',
      scope: SCOPES,
      redirect_uri: process.env.REDIRECT_URI || '',
      state,
    });
    res.redirect(`${SPOTIFY_AUTH}?${params.toString()}`);
  });

  app.get('/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

    if (error) return res.redirect(`${clientOrigin}/#error=${encodeURIComponent(error)}`);
    if (!state || !pendingStates.has(state)) {
      return res.redirect(`${clientOrigin}/#error=state_mismatch`);
    }
    pendingStates.delete(state);

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: process.env.REDIRECT_URI || '',
      });
      const r = await fetch(SPOTIFY_TOKEN, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = await r.json();
      if (!r.ok) {
        return res.redirect(`${clientOrigin}/#error=${encodeURIComponent(data.error || 'token_exchange_failed')}`);
      }

      const frag = new URLSearchParams({
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_in: String(data.expires_in || 3600),
      });
      res.redirect(`${clientOrigin}/#${frag.toString()}`);
    } catch (e) {
      console.error('[auth] callback error', e);
      res.redirect(`${clientOrigin}/#error=server_error`);
    }
  });

  app.post('/auth/refresh', async (req, res) => {
    const refresh_token = req.body?.refresh_token;
    if (!refresh_token) return res.status(400).json({ error: 'missing refresh_token' });
    try {
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token });
      const r = await fetch(SPOTIFY_TOKEN, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);

      res.json({
        access_token: data.access_token,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token || refresh_token,
      });
    } catch (e) {
      console.error('[auth] refresh error', e);
      res.status(500).json({ error: 'server_error' });
    }
  });
}
