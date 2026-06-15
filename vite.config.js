import { defineConfig } from 'vite';

// Served under /zpektra/ so it can live as a page on zaidwajid.dev/zpektra.
// No backend needed — auth is Authorization Code + PKCE in the browser.
export default defineConfig({
  base: '/zpektra/',
  server: {
    host: '127.0.0.1', // IPv4 loopback so Spotify's redirect URI matches
    port: 5173,
  },
});
