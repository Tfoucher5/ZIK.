import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { roomGames } from "$lib/server/state.js";

function makeCache(ttlMs) {
  let _data = null, _exp = 0;
  return {
    get() { return _exp > Date.now() ? _data : null; },
    set(v) { _data = v; _exp = Date.now() + ttlMs; },
  };
}
const _cache = makeCache(15_000); // cache 15s (plus court que official pour fraîcheur)

export async function GET() {
  try {
    let base = _cache.get();
    if (!base) {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          "code, name, emoji, description, last_active_at, profiles!owner_id(username)",
        )
        .eq("is_public", true)
        .eq("is_official", false)
        .order("last_active_at", { ascending: false })
        .limit(24);

      if (error) throw error;
      base = (data || []).map((r) => ({
        id: r.code,
        name: r.name,
        emoji: r.emoji || "🎵",
        description: r.description || "",
        host: r.profiles?.username || null,
      }));
      _cache.set(base);
    }

    const result = base
      .map((r) => ({
        ...r,
        online: Object.values(roomGames)
          .filter((g) => g.roomId === r.id)
          .reduce(
            (acc, g) =>
              acc + Object.values(g.players).filter((p) => !p._dcTimer).length,
            0,
          ),
      }))
      .sort((a, b) => b.online - a.online); // actives en premier

    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
