import 'dotenv/config';
import express from 'express';
import { registerAuthRoutes } from './auth.js';
import { registerSpotifyRoutes } from './spotify.js';
import { registerLyricsRoutes } from './lyrics.js';

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json());

app.use((req, res, next) => {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

registerAuthRoutes(app);
registerSpotifyRoutes(app);
registerLyricsRoutes(app);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.warn('[server] WARNING: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set. Copy .env.example to .env.');
  }
});
