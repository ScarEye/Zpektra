import { Session } from '../auth/session.js';

let player = null;
let deviceId = null;

function whenSdkReady() {
  if (window.Spotify) return Promise.resolve();
  return window.zpektraSdkReady || Promise.resolve();
}

export const Player = {
  async init() {
    await whenSdkReady();

    player = new window.Spotify.Player({
      name: 'Zpektra Visualizer',
      getOAuthToken: async (cb) => cb(await Session.ensureFresh()),
      volume: 0.8,
    });

    player.addListener('initialization_error', ({ message }) => console.error('[player] init', message));
    player.addListener('authentication_error', ({ message }) => console.error('[player] auth', message));
    player.addListener('account_error', ({ message }) =>
      console.error('[player] account (Premium required?)', message)
    );

    const ready = new Promise((resolve) => {
      player.addListener('ready', async ({ device_id }) => {
        deviceId = device_id;
        console.log('[player] ready, device', device_id);
        await Player.transferHere();
        resolve(device_id);
      });
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.warn('[player] device went offline', device_id);
    });

    const ok = await player.connect();
    if (!ok) console.warn('[player] connect() returned false');
    return ready;
  },

  async transferHere() {
    if (!deviceId) return;
    try {
      await fetch('/api/transfer', {
        method: 'PUT',
        headers: { Authorization: Session.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
    } catch (e) {
      console.error('[player] transfer failed', e);
    }
  },

  onState(cb) {
    if (player) player.addListener('player_state_changed', cb);
  },

  resume() {
    return player?.resume();
  },
  togglePlay() {
    return player?.togglePlay();
  },
  deviceId() {
    return deviceId;
  },
};
