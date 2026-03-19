import { json } from "@sveltejs/kit";
import { getFetch } from "$lib/server/services/fetch.js";
import { checkRateLimit } from "$lib/server/middleware/auth.js";

export async function GET({ params, request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 10, 60_000);

  try {
    const fetchFn = await getFetch();
    const headers = { "User-Agent": "ZIK-BlindTest/1.0" };
    const plId = params.id;

    const r = await fetchFn(`https://api.deezer.com/playlist/${plId}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error)
      throw new Error(data.error.message || "Playlist introuvable");

    const total = data.nb_tracks || data.tracks?.total || 0;
    if (!total) throw new Error("Playlist vide ou priv\u00e9e");

    let allTracks = [];
    while (allTracks.length < Math.min(total, 1000)) {
      const index = allTracks.length;
      const nextR = await fetchFn(
        `https://api.deezer.com/playlist/${plId}/tracks?index=${index}&limit=100`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!nextR.ok) break;
      const nextData = await nextR.json();
      if (nextData.error || !nextData.data?.length) break;
      allTracks = allTracks.concat(nextData.data);
      if (nextData.data.length < 100) break;
    }

    if (!allTracks.length)
      throw new Error(
        "Impossible de r\u00e9cup\u00e9rer les titres (playlist vide ou priv\u00e9e)",
      );

    const tracks = allTracks
      .filter((t) => t.readable !== false)
      .map((t) => ({
        external_id: String(t.id),
        source: "deezer",
        artist: t.artist.name,
        title: t.title,
        preview_url: t.preview || null,
        cover_url: t.album.cover_xl || t.album.cover_big || null,
      }));

    return json({
      name: data.title,
      cover: data.picture_xl || data.picture_big || null,
      tracks,
    });
  } catch (e) {
    return json({ error: e.message }, { status: 502 });
  }
}
