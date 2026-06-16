export const SPOTIFY_CLIENT_ID = '0b741d2424d340c28066a9619425883a';

export const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

export const SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
].join(' ');
