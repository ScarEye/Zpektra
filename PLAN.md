# Spotify Audio Visualizer — Build Plan

A web app: visit link → log in with Spotify (Premium) → pick a visualizer → watch
three.js visuals react in real time to the song playing in Spotify.

## The core constraint (why the design looks the way it does)

- **Spotify audio is DRM-protected (EME).** You cannot attach a Web Audio
  `AnalyserNode` to the Web Playback SDK stream. No real FFT from Spotify's audio.
- **Beat/tempo data is gone for new apps.** `audio-analysis`, `audio-features`,
  recommendations and preview URLs were deprecated Nov 27 2024 → new apps get `403`.

**Decision:** get the music metadata + playback state from Spotify, but get the
*reactivity* by capturing the tab/system audio with `getDisplayMedia` and running a
real `AnalyserNode` FFT on that captured stream. This gives genuine sync.

## Architecture

```
Browser (Vite + three.js)                 Node backend (Express)
─────────────────────────                 ──────────────────────
Landing / Login  ───────────────────────► /auth/login  → Spotify consent
Callback         ◄──────────────────────  /auth/callback (code → tokens)
                  access/refresh token  ◄─ /auth/refresh
Web Playback SDK (plays in browser, Premium)
Now-playing poller ─────────────────────► /api/now-playing (proxy w/ token)
getDisplayMedia → AnalyserNode (FFT) ────► drives three.js visualizers
Album art → color palette ───────────────► visualizer theming
```

- **Backend** keeps the Spotify client secret off the client and does the OAuth
  token exchange + refresh. Authorization Code flow (with PKCE as defense in depth).
- **Frontend** handles playback (Web Playback SDK), audio capture, and rendering.

## Tech stack

- Vite (dev server + build), vanilla JS/TS modules
- three.js for rendering; GLSL shaders for the "crazy" effects
- Web Audio API: `getDisplayMedia({ audio:true })` → `AnalyserNode` (FFT + waveform)
- Spotify Web Playback SDK + Web API
- Express (Node) for `/auth/*` and a thin now-playing proxy
- `.env` for `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `REDIRECT_URI`

## Project structure

```
WebVisualizer/
├─ server/
│  ├─ index.js            # Express app
│  ├─ auth.js             # /auth/login, /auth/callback, /auth/refresh
│  └─ spotify.js          # token helpers, now-playing proxy
├─ src/
│  ├─ main.js             # app bootstrap, scene/route state
│  ├─ auth/session.js     # token storage, refresh timer
│  ├─ spotify/player.js   # Web Playback SDK init + state events
│  ├─ spotify/nowplaying.js
│  ├─ audio/capture.js    # getDisplayMedia + AnalyserNode, exposes bands
│  ├─ audio/analyser.js   # FFT → bass/mid/treble, beat detection, smoothing
│  ├─ visualizers/
│  │  ├─ registry.js      # list + metadata for the picker
│  │  ├─ base.js          # common lifecycle (init/update/resize/dispose)
│  │  ├─ bars.js          # reactive frequency bars
│  │  ├─ particles.js     # GPU particle field that pulses on bass/beat
│  │  └─ tunnel.js        # shader warp tunnel reacting to spectrum
│  └─ ui/
│     ├─ login.js
│     └─ picker.js        # choose visualizer
├─ public/                # static assets
├─ .env.example
└─ package.json
```

## Audio pipeline (the heart of it)

1. After login + a track is playing, prompt user once: "Share the Spotify tab and
   tick *Share tab audio*" → `getDisplayMedia({ video:true, audio:true })`.
2. Take the audio track from that stream → `AudioContext` → `AnalyserNode`
   (`fftSize` 2048–4096).
3. Each frame: read `getByteFrequencyData`, reduce to bands (bass/low-mid/mid/
   high), compute an energy envelope, run simple onset/beat detection, smooth.
4. Expose a small reactive object (`{ bass, mid, treble, energy, beat }`) that any
   visualizer reads in its `update()`.
5. Album-art colors (sampled client-side) feed each visualizer's palette.

## Visualizer plan

Start with 3 strong ones behind a common `base` interface so adding more is cheap:

- **Frequency bars** — radial/linear spectrum, the obvious crowd-pleaser, good for
  validating the FFT pipeline.
- **GPU particles** — large particle field; bass pumps scale/turbulence, beats
  trigger bursts. Colored from album art.
- **Shader tunnel** — fragment-shader warp tunnel whose speed/distortion/hue track
  energy and spectrum. This is the "crazy" one.

## Build phases

1. **Scaffold** — Vite + three.js + Express, `.env`, dev scripts, register a
   Spotify app, set redirect URI to `http://localhost:5173/callback`.
2. **Auth** — full login flow, token storage + refresh, gate the app on a session.
3. **Playback** — Web Playback SDK as a device, transfer playback, read now-playing
   (track, progress, art).
4. **Audio capture** — `getDisplayMedia` + AnalyserNode, on-screen debug meters for
   bass/mid/treble/beat.
5. **Visualizers** — base interface + the 3 above, wire to reactive data + palette.
6. **Picker UI** — landing → login → picker → fullscreen visualizer, with a HUD
   (track name, switch visualizer, re-share audio).
7. **Polish** — performance (cap DPR, dispose on switch), graceful fallbacks if the
   user denies audio share (procedural mode from progress + palette).

## Known gotchas

- `getDisplayMedia` audio capture works best in Chrome/Edge; the user must tick
  "share tab audio". Document this in the UI.
- Web Playback SDK requires **Premium** and a user gesture to start audio.
- Tokens expire (~1h) → silent refresh via the backend.
- Spotify dev app may need the target Spotify account added under
  Users & Access while in development mode.
