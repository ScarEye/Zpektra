# Zpektra

A browser music visualizer, made for fun. The idea is the old Windows XP Media
Player visualizations — the ones that moved with the song while you just sat
and watched. This one runs locally in the browser, so there is nothing extra
to install and no separate player to set up. Open the page, connect Spotify,
and play.

It logs into Spotify with PKCE (no backend and no client secret), reads the
current track, and draws reactive scenes from audio captured on your machine.

Licensed under the MIT License. Copyright (c) 2026 ScarEye. See [LICENSE](LICENSE).

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
2. Under **Redirect URIs**, add exactly, with the trailing slash:
   `http://127.0.0.1:5173/zpektra/`
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

1. On the welcome screen, choose **Enter Zpektra**, then **Connect Spotify**.
2. Play a track in your normal Spotify app (playback stays there).
3. The library lists finished visualizers. **Prototypes** (Particle Storm, Golden Sigil, and the mesh studies) sit in their own panel, and again inside **All** while a scene is open. Star a scene to pin it on the dock.
4. Pick a visualizer, then connect audio:
   - **Audio input device (recommended):** **Enable audio input**, then pick the device under **Audio**. For clean Spotify audio use a virtual loopback (below).
   - **Screen audio:** **Use screen audio** → Entire Screen and share system audio, or the Spotify tab and share tab audio.
5. Drag to orbit 3D scenes, scroll to zoom. **Look** sets album, custom, or cycling color, plus rotation and intensity. **Audio** chooses the input and how hits are detected. **Lyrics** toggles timed lyrics (LRCLIB, not Spotify). **H** hides the controls, **D** shows meters, **M** switches grid and dots on the mesh prototypes.

### Clean, direct Spotify audio (virtual loopback)

A browser can't tap the DRM stream directly, but you can route Spotify's output
into a virtual audio device and select it as the input — clean digital audio, no
screen share, one-time permission.

- **Windows:** [VB-Audio Cable](https://vb-audio.com/Cable/) or VoiceMeeter (or
  "Stereo Mix" if present). Set it as the output, pick **CABLE Output** as the
  input. Use VoiceMeeter if you also want to hear the music.
- **macOS:** [BlackHole](https://existential.audio/blackhole/) + a Multi-Output
  Device, then pick BlackHole as the input.

## Project layout

```
src/
  main.js            screens, session, now-playing
  meta.js            product name and ScarEye copyright line
  config.js          client id, redirect uri, scopes
  engine.js          renderer, loop, orbit controls
  auth/session.js    PKCE login, token exchange, refresh
  spotify/           now-playing, playback clock, LRCLIB lyrics
  audio/             capture, reactor, bands, presets, detectors
  visualizers/       registry (release vs prototype) and scenes
  ui/                library, stage chrome, lyrics, colors, debug
  styles/            base, screens, stage
```

There is no backend. Spotify auth is PKCE in the browser. Lyrics are fetched from LRCLIB.

## License

MIT. Copyright (c) 2026 ScarEye. The license covers this project. three.js remains under its own license.
