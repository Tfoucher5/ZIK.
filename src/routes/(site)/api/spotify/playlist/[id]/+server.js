import { json } from '@sveltejs/kit';
import { getSpotifyToken, normalizeSpotifyItem } from '$lib/server/services/spotify.js';
import { getFetch } from '$lib/server/services/fetch.js';
import { checkRateLimit } from '$lib/server/middleware/auth.js';

export async function GET({ params, request }) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  checkRateLimit(ip, 10, 60_000);

  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    const plId    = params.id;

    const plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
    if (!plRes.ok) throw new Error('Playlist introuvable ou priv\u00e9e');
    const pl            = await plRes.json();
    const total         = pl.tracks?.total || 0;
    const embeddedItems = pl.tracks?.items || [];
    let allItems = [], offset = 0, loopTotal = total > 0 ? total : 9999, itemsOk = true;

    while (allItems.length < Math.min(loopTotal, 1000)) {
      const tRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}/items?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
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
    return json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal });
  } catch (e) {
    return json({ error: e.message }, { status: 502 });
  }
}
