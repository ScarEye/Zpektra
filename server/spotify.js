const API = 'https://api.spotify.com/v1';

export function registerSpotifyRoutes(app) {

  app.get('/api/now-playing', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'missing token' });
    try {
      const r = await fetch(`${API}/me/player/currently-playing`, {
        headers: { Authorization: auth },
      });
      if (r.status === 204) return res.json({ playing: false });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);

      const item = data.item || {};
      res.json({
        playing: Boolean(data.is_playing),
        progress_ms: data.progress_ms ?? 0,
        duration_ms: item.duration_ms ?? 0,
        track_id: item.id ?? null,
        title: item.name ?? '',
        artists: (item.artists || []).map((a) => a.name).join(', '),
        album: item.album?.name ?? '',
        art: item.album?.images?.[0]?.url ?? null,
      });
    } catch (e) {
      console.error('[spotify] now-playing error', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.put('/api/transfer', async (req, res) => {
    const auth = req.headers.authorization;
    const device_id = req.body?.device_id;
    if (!auth) return res.status(401).json({ error: 'missing token' });
    if (!device_id) return res.status(400).json({ error: 'missing device_id' });
    try {
      const r = await fetch(`${API}/me/player`, {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: [device_id], play: true }),
      });
      if (r.status === 204) return res.json({ ok: true });
      const data = await r.json().catch(() => ({}));
      res.status(r.status).json(data);
    } catch (e) {
      console.error('[spotify] transfer error', e);
      res.status(500).json({ error: 'server_error' });
    }
  });
}
