// Polls Spotify's Web API directly (no backend) for the currently playing track.
// Notifies subscribers each tick with the latest state, flagging track changes
// so visualizers can re-theme from album art.

import { Session } from '../auth/session.js';

const API = 'https://api.spotify.com/v1/me/player/currently-playing';

let current = null;
let playing = false;
let timer = null;
const subscribers = new Set();

async function poll() {
  if (!Session.isValid()) return;
  try {
    await Session.ensureFresh();
    const r = await fetch(API, { headers: { Authorization: Session.authHeader() } });
    if (r.status === 204) {
      playing = false;
      subscribers.forEach((cb) => cb(current, false, false));
      return;
    }
    if (!r.ok) return;
    const data = await r.json();
    const item = data.item || {};
    const track = {
      playing: Boolean(data.is_playing),
      progress_ms: data.progress_ms ?? 0,
      duration_ms: item.duration_ms ?? 0,
      track_id: item.id ?? null,
      title: item.name ?? '',
      artists: (item.artists || []).map((a) => a.name).join(', '),
      album: item.album?.name ?? '',
      art: item.album?.images?.[0]?.url ?? null,
    };
    const changed = !current || current.track_id !== track.track_id;
    current = track;
    playing = track.playing;
    subscribers.forEach((cb) => cb(track, changed, playing));
  } catch {
    /* network blip — retry next tick */
  }
}

export const NowPlaying = {
  start(intervalMs = 2000) {
    poll();
    clearInterval(timer);
    timer = setInterval(poll, intervalMs);
  },
  stop() {
    clearInterval(timer);
  },
  get() {
    return current;
  },
  isPlaying() {
    return playing;
  },
  subscribe(cb) {
    subscribers.add(cb);
    if (current) cb(current, true, playing);
    return () => subscribers.delete(cb);
  },
};
