import { getFetch } from './fetch.js';

let _spotifyToken       = null;
let _spotifyTokenExpiry = 0;

export async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;

  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify non configure');

  const fetchFn = await getFetch();
  const res = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify Auth Error ${res.status}`);
  const json = await res.json();
  _spotifyToken       = json.access_token;
  _spotifyTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _spotifyToken;
}

export function normalizeSpotifyItem(i) {
  const t = i?.item ?? i?.track;
  if (!t?.id || t.type === 'episode' || i.is_local) return null;
  return {
    external_id: t.id,
    source:      'spotify',
    artist:      t.artists?.length > 1
      ? `${t.artists[0].name} (feat. ${t.artists.slice(1).map(a => a.name).join(', ')})`
      : (t.artists?.[0]?.name || '?'),
    title:       t.name,
    preview_url: t.preview_url || null,
    cover_url:   t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null,
  };
}
