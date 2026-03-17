import { json } from '@sveltejs/kit';
import { getSpotifyToken, normalizeSpotifyItem } from '$lib/server/services/spotify.js';
import { getFetch } from '$lib/server/services/fetch.js';
import { checkRateLimit } from '$lib/server/middleware/auth.js';

export async function GET({ params, request }) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  checkRateLimit(ip, 10, 60_000);

  const userToken = request.headers.get('x-spotify-token');
  const plId      = params.id;
  if (!userToken) return json({ error: 'X-Spotify-Token manquant' }, { status: 400 });

  const fetchFn = await getFetch();

  try {
    let plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
      headers: { Authorization: `Bearer ${userToken}` }, signal: AbortSignal.timeout(12000),
    });

    let currentToken = userToken;

    if (!plRes.ok) {
      if (plRes.status === 401) return json({ error: 'Token Spotify expir\u00e9 \u2014 reconnecte-toi.' }, { status: 401 });
      if (plRes.status === 404) return json({ error: 'Playlist introuvable.' }, { status: 404 });
      currentToken = await getSpotifyToken();
      plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
        headers: { Authorization: `Bearer ${currentToken}` }, signal: AbortSignal.timeout(12000),
      });
      if (!plRes.ok) return json({ error: 'Playlist inaccessible.' }, { status: plRes.status });
    }

    const pl            = await plRes.json();
    const total         = pl.tracks?.total || 0;
    const embeddedItems = pl.tracks?.items || [];
    let allItems  = [], offset = 0, loopTotal = total > 0 ? total : 9999, itemsOk = true;

    while (allItems.length < Math.min(loopTotal, 1000)) {
      const tRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}/items?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${currentToken}` }, signal: AbortSignal.timeout(12000) });
      if (tRes.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
      if (!tRes.ok) { itemsOk = false; break; }
      const page = await tRes.json();
      if (typeof page.total === 'number') loopTotal = Math.min(page.total, 1000);
      if (!page.items?.length) break;
      allItems = allItems.concat(page.items);
      offset  += page.items.length;
      if (page.items.length < 50) break;
    }

    const rawItems = itemsOk ? allItems : embeddedItems;
    const tracks   = rawItems.map(normalizeSpotifyItem).filter(Boolean);
    if (!tracks.length) return json({ error: `Aucune piste r\u00e9cup\u00e9r\u00e9e (${rawItems.length} items bruts). Playlist vide ou priv\u00e9e ?` }, { status: 422 });

    const limited   = total > 100 && tracks.length <= 100;
    const truncated = loopTotal > tracks.length;
    return json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal, truncated, limited });
  } catch (e) {
    return json({ error: e.message }, { status: 502 });
  }
}
