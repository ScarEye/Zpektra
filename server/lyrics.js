const LRCLIB = 'https://lrclib.net';
const CLIENT = 'Zpektra v0.1.0 (https://zaidwajid.dev/)';

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h
const MAX_CACHE = 200;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

async function lrclibGet(params) {
  const qs = new URLSearchParams(params);
  const r = await fetch(`${LRCLIB}/api/get?${qs}`, {
    headers: {
      'Lrclib-Client': CLIENT,
      'User-Agent': CLIENT,
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const err = new Error(`lrclib ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

async function lrclibSearch(trackName, artistName) {
  const qs = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
  });
  const r = await fetch(`${LRCLIB}/api/search?${qs}`, {
    headers: {
      'Lrclib-Client': CLIENT,
      'User-Agent': CLIENT,
    },
  });
  if (!r.ok) return [];
  const arr = await r.json();
  return Array.isArray(arr) ? arr : [];
}

export function registerLyricsRoutes(app) {
  app.get('/api/lyrics', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const artist = String(req.query.artist || '').trim();
    const album = String(req.query.album || '').trim();
    const durationSec = Number(req.query.duration || 0);
    const trackId = String(req.query.track_id || '').trim();

    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist required' });
    }

    const cacheKey = trackId || `${title}|${artist}|${durationSec}|${album}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
      const primaryArtist = artist.split(',')[0].trim();
      const params = {
        track_name: title,
        artist_name: primaryArtist,
      };
      if (album) params.album_name = album;
      if (durationSec > 0) params.duration = String(Math.round(durationSec));

      let data = await lrclibGet(params);

      if (!data) {
        const results = await lrclibSearch(title, primaryArtist);
        data =
          results.find((x) => x.syncedLyrics) ||
          results.find((x) => x.plainLyrics) ||
          results[0] ||
          null;
      }

      if (!data) {
        const payload = { found: false, instrumental: false, synced: false, lines: [], plain: null };
        cacheSet(cacheKey, payload);
        return res.json(payload);
      }

      const payload = {
        found: true,
        instrumental: Boolean(data.instrumental),
        synced: Boolean(data.syncedLyrics),
        syncedLyrics: data.syncedLyrics || null,
        plainLyrics: data.plainLyrics || null,
        trackName: data.trackName || title,
        artistName: data.artistName || artist,
      };
      cacheSet(cacheKey, payload);
      return res.json(payload);
    } catch (e) {
      console.error('[lyrics]', e);
      const status = e.status === 429 ? 429 : 502;
      return res.status(status).json({ error: 'lyrics_fetch_failed' });
    }
  });
}
