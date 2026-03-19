import { json } from "@sveltejs/kit";
import {
  getSpotifyToken,
  normalizeSpotifyItem,
} from "$lib/server/services/spotify.js";
import { getFetch } from "$lib/server/services/fetch.js";
import { checkRateLimit } from "$lib/server/middleware/auth.js";

export async function GET({ request, url }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 30, 60_000);

  const q = url.searchParams.get("q")?.trim();
  if (!q) return json({ error: "Param\u00e8tre q requis" }, { status: 400 });

  try {
    const token = await getSpotifyToken();
    const fetchFn = await getFetch();
    const params = new URLSearchParams({
      q,
      type: "track",
      limit: "10",
      market: "FR",
    });
    const r = await fetchFn(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    return json(
      (data.tracks?.items || []).map((t) => ({
        external_id: t.id,
        source: "spotify",
        artist: t.artists.map((a) => a.name).join(", "),
        title: t.name,
        preview_url: t.preview_url || null,
        cover_url: t.album.images[1]?.url || t.album.images[0]?.url || null,
      })),
    );
  } catch (e) {
    return json({ error: e.message }, { status: 502 });
  }
}
