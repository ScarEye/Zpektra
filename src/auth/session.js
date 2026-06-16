import { SPOTIFY_CLIENT_ID, REDIRECT_URI, SCOPES } from '../config.js';

const AUTHORIZE = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const KEY = 'zpektra.session';
const PKCE_KEY = 'zpektra.pkce';

let session = { access_token: null, refresh_token: null, expires_at: 0 };
let refreshTimer = null;

function save() {
  localStorage.setItem(KEY, JSON.stringify(session));
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) session = { ...session, ...JSON.parse(raw) };
  } catch {
      }
}

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}
function base64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function challengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

function applyToken(data) {
  session.access_token = data.access_token;
  if (data.refresh_token) session.refresh_token = data.refresh_token;
  session.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
  save();
  scheduleRefresh();
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  const r = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('token exchange failed');
  applyToken(await r.json());
}

async function refresh() {
  if (!session.refresh_token) return false;
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refresh_token,
      client_id: SPOTIFY_CLIENT_ID,
    });
    const r = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error('refresh failed');
    applyToken(await r.json());
    return true;
  } catch (e) {
    console.error('[auth] refresh error', e);
    return false;
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  const delay = Math.max(5000, session.expires_at - Date.now() - 60000);
  refreshTimer = setTimeout(refresh, delay);
}

export const Session = {

  async init() {
    load();
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error');

    if (err) {
      console.error('[auth] login error:', err);
      history.replaceState(null, '', import.meta.env.BASE_URL);
    }

    let justLoggedIn = false;
    if (code) {
      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem(PKCE_KEY)) || {};
      } catch {
      }
      localStorage.removeItem(PKCE_KEY);
      history.replaceState(null, '', import.meta.env.BASE_URL);
      if (stored.state && stored.state === state && stored.verifier) {
        try {
          await exchangeCode(code, stored.verifier);
          justLoggedIn = true;
        } catch (e) {
          console.error('[auth] code exchange failed', e);
        }
      } else {
        console.error('[auth] state mismatch — ignoring callback');
      }
    }

    if (this.isValid()) scheduleRefresh();
    return { valid: this.isValid(), justLoggedIn };
  },

  isValid() {
    return Boolean(session.access_token) && Date.now() < session.expires_at;
  },
  token() {
    return session.access_token;
  },
  authHeader() {
    return `Bearer ${session.access_token}`;
  },
  async ensureFresh() {
    if (Date.now() > session.expires_at - 30000) await refresh();
    return session.access_token;
  },

  async login() {
    const verifier = randomString(64);
    const state = randomString(16);
    const challenge = await challengeFromVerifier(verifier);
    localStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });
    location.href = `${AUTHORIZE}?${params.toString()}`;
  },

  logout() {
    clearTimeout(refreshTimer);
    session = { access_token: null, refresh_token: null, expires_at: 0 };
    localStorage.removeItem(KEY);
  },
};
