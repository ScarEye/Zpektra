# Zpektra — Spotify Audio Visualizer

A static three.js music visualizer that logs into Spotify (PKCE, no backend),
captures your audio, and renders reactive 3D visuals. Built to live at
`zaidwajid.dev/zpektra`.

## How it works (and the constraints)

- Spotify's audio is DRM-protected, so the browser **cannot** read its waveform,
  and Spotify's beat/tempo API was deprecated for new apps in Nov 2024. So Zpektra
  reads the *now-playing* track via the Web API (title/artist/art/play state) and
  gets real reactivity from your **captured audio**.
- Auth is **Authorization Code + PKCE**, entirely in the browser — no server and
  no client secret. That's what lets it ship as a static page.
- All visual motion is gated on live audio level + play state, so silence settles
  the visuals instead of looping.

## Setup (Spotify app)

1. Open your app at https://developer.spotify.com/dashboard.
2. Under **Redirect URIs**, add (exactly, with trailing slash):
   - `http://127.0.0.1:5173/zpektra/`  (local dev)
   - `https://zaidwajid.dev/zpektra/`  (production)
   Spotify requires `127.0.0.1` (not `localhost`) for http.
3. The **Client ID** is already set in `src/config.js`. PKCE needs no secret, so
   the old `.env`/backend are no longer required.
4. While the app is in development mode, add your account under **Users & Access**.

## Run locally

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173/zpektra/** (note the `/zpektra/` path).

## Using it

1. The **Achievement Unlocked** welcome screen → **Enter Zpektra** → **Connect Spotify**.
2. Play a track in your normal Spotify app (playback stays there).
3. Pick a visualizer, then connect audio:
   - **Audio input device (recommended):** **Enable audio input**, choose a device
     in the bottom bar (switch any time). For clean, direct Spotify audio use a
     virtual loopback (below).
   - **Screen/tab audio:** **Use screen / tab audio** → Entire Screen + *Share
     system audio*, or the Spotify tab + *Share tab audio*.
4. Drag to rotate the 3D visualizers, scroll to zoom. **Colors** button switches
   between album-art / custom (picker + hex) / auto-cycle. Press **D** for live
   frequency meters.

### Clean, direct Spotify audio (virtual loopback)

A browser can't tap the DRM stream directly, but you can route Spotify's output
into a virtual audio device and select it as the input — clean digital audio, no
screen share, one-time permission.

- **Windows:** [VB-Audio Cable](https://vb-audio.com/Cable/) or VoiceMeeter (or
  "Stereo Mix" if present). Set it as the output, pick **CABLE Output** as the
  input. Use VoiceMeeter if you also want to hear the music.
- **macOS:** [BlackHole](https://existential.audio/blackhole/) + a Multi-Output
  Device, then pick BlackHole as the input.

## Deploy under zaidwajid.dev/zpektra

`npm run build` outputs to `dist/` with all asset paths under `/zpektra/`
(because `vite.config.js` sets `base: '/zpektra/'`). Two common options:

- **Same repo as the portfolio:** copy `dist/` into your site at `/zpektra/` (so
  `https://zaidwajid.dev/zpektra/index.html` is served), or add it as a build step.
- **Vercel/Netlify:** deploy this project and route `zaidwajid.dev/zpektra` to it.

Make sure the production redirect URI (`https://zaidwajid.dev/zpektra/`) is in the
Spotify dashboard.

## Portfolio "achievement" button (paste into zaidwajid.dev)

This lives in your **portfolio** code, not this project. Once an achievement is
unlocked, reveal a button top-left next to ZAID.DEV that links to the visualizer:

```html
<a id="zpektra-link" href="/zpektra/" style="display:none">🏆 Zpektra</a>
<script>
  // call unlockZpektra() from your achievement logic
  function unlockZpektra() {
    localStorage.setItem('zpektra.unlocked', '1');
    document.getElementById('zpektra-link').style.display = 'inline-flex';
  }
  if (localStorage.getItem('zpektra.unlocked') === '1') {
    document.getElementById('zpektra-link').style.display = 'inline-flex';
  }
</script>
```

## Project layout

```
src/
  config.js        client id, redirect uri, scopes
  auth/session.js  PKCE login, token exchange + refresh
  spotify/         now-playing polling (direct Web API)
  audio/           getUserMedia / getDisplayMedia capture + FFT reactor
  visualizers/     base, registry, blob, terrain, rings, particles, bars,
                   tunnel, palette, glsl-noise
  ui/              picker, colors, debug
  engine.js        renderer + loop + orbit controls + color ticking
  main.js          screens (welcome → login → picker → visualizer)
```
