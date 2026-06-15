// App configuration for the static (no-backend) PKCE build.
//
// PKCE only needs the public Client ID — there is NO client secret in the
// browser, which is what makes this safe to ship as a static site.
//
// The redirect URI is computed from where the app is actually served, so it
// works the same in local dev and in production under /zpektra/. Whatever this
// resolves to must be added to your Spotify app's "Redirect URIs":
//   local dev:   http://127.0.0.1:5173/zpektra/
//   production:  https://zaidwajid.dev/zpektra/

export const SPOTIFY_CLIENT_ID = '0b741d2424d340c28066a9619425883a';

// import.meta.env.BASE_URL is the Vite `base` (e.g. "/zpektra/").
export const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

export const SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
].join(' ');
