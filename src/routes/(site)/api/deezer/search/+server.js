import { json } from "@sveltejs/kit";
import { getFetch } from "$lib/server/services/fetch.js";
import { checkRateLimit } from "$lib/server/middleware/auth.js";

export async function GET({ request, url }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 30, 60_000);

  const q = url.searchParams.get("q")?.trim();
  if (!q) return json({ error: "Param\u00e8tre q requis" }, { status: 400 });

  try {
    const fetchFn = await getFetch();
    const r = await fetchFn(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20`,
      {
        headers: { "User-Agent": "ZIK-BlindTest/1.0" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    return json(
      (data.data || []).map((t) => ({
        external_id: String(t.id),
        source: "deezer",
        artist: t.artist.name,
        title: t.title,
        preview_url: t.preview || null,
        cover_url: t.album.cover_xl || t.album.cover_big || null,
      })),
    );
  } catch (e) {
    return json({ error: e.message }, { status: 502 });
  }
}
