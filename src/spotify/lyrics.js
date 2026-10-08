const LRCLIB = 'https://lrclib.net';
const CLIENT = 'Zpektra v0.1.0 (https://zaidwajid.dev/)';
const cache = new Map();

const LRC_LINE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;

export function parseLrc(syncedLyrics) {
  if (!syncedLyrics) return [];
  const lines = [];
  for (const raw of syncedLyrics.split(/\r?\n/)) {
    const m = raw.match(LRC_LINE);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
    const text = (m[4] || '').trim();
    if (!text) continue;
    lines.push({ t: min * 60000 + sec * 1000 + frac, text });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

/** Binary search: last line with t <= nowMs */
export function activeLineIndex(lines, nowMs) {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= nowMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'Lrclib-Client': CLIENT },
  });
  return r;
}

async function getFromLrclib({ title, artist, album, durationSec }) {
  const primaryArtist = (artist || '').split(',')[0].trim();
  const params = new URLSearchParams({
    track_name: title,
    artist_name: primaryArtist,
  });
  if (album) params.set('album_name', album);
  if (durationSec > 0) params.set('duration', String(Math.round(durationSec)));

  let r = await fetchJson(`${LRCLIB}/api/get?${params}`);
  if (r.ok) return r.json();

  if (r.status === 404) {
    const sq = new URLSearchParams({
      track_name: title,
      artist_name: primaryArtist,
    });
    r = await fetchJson(`${LRCLIB}/api/search?${sq}`);
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.find((x) => x.syncedLyrics) || arr.find((x) => x.plainLyrics) || arr[0];
  }
  return null;
}

/**
 * Fetch timed lyrics for a Spotify track.
 * Tries optional local `/api/lyrics` proxy first, then LRCLIB directly (CORS-enabled).
 */
export async function fetchLyrics(track) {
  if (!track?.title || !track?.artists) {
    return { found: false, instrumental: false, synced: false, lines: [], plain: null };
  }

  const key = track.track_id || `${track.title}|${track.artists}|${track.duration_ms}`;
  if (cache.has(key)) return cache.get(key);

  const durationSec = (track.duration_ms || 0) / 1000;
  const qs = new URLSearchParams({
    title: track.title,
    artist: track.artists,
    album: track.album || '',
    duration: String(Math.round(durationSec)),
    track_id: track.track_id || '',
  });

  let payload = null;

  // Optional backend proxy (when Express is running)
  try {
    const proxy = await fetch(`/api/lyrics?${qs}`);
    if (proxy.ok) {
      const data = await proxy.json();
      if (data && (data.found !== undefined || data.syncedLyrics !== undefined)) {
        payload = normalizePayload(data);
      }
    }
  } catch {
    /* proxy unavailable — fall through */
  }

  if (!payload) {
    try {
      const data = await getFromLrclib({
        title: track.title,
        artist: track.artists,
        album: track.album,
        durationSec,
      });
      if (!data) {
        payload = { found: false, instrumental: false, synced: false, lines: [], plain: null };
      } else {
        payload = normalizePayload({
          found: true,
          instrumental: data.instrumental,
          syncedLyrics: data.syncedLyrics,
          plainLyrics: data.plainLyrics,
        });
      }
    } catch (e) {
      console.warn('[lyrics] fetch failed', e);
      payload = { found: false, instrumental: false, synced: false, lines: [], plain: null, error: true };
    }
  }

  cache.set(key, payload);
  return payload;
}

function normalizePayload(data) {
  if (data.found === false) {
    return { found: false, instrumental: false, synced: false, lines: [], plain: null };
  }
  const lines = parseLrc(data.syncedLyrics || '');
  const synced = lines.length > 0;
  return {
    found: Boolean(data.found !== false && (synced || data.plainLyrics || data.instrumental)),
    instrumental: Boolean(data.instrumental),
    synced,
    lines,
    plain: data.plainLyrics || data.plain || null,
  };
}
