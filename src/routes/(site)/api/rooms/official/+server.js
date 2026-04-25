import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { roomGames } from "$lib/server/state.js";

function makeCache(ttlMs) {
  let _data = null,
    _exp = 0;
  return {
    get() {
      return _exp > Date.now() ? _data : null;
    },
    set(v) {
      _data = v;
      _exp = Date.now() + ttlMs;
    },
  };
}
const _cache = makeCache(30_000);

export async function GET() {
  try {
    let base = _cache.get();
    if (!base) {
      const { data, error } = await supabase
        .from("rooms")
        .select("code, name, emoji, description, game_mode, is_official")
        .eq("is_official", true)
        .order("created_at");
      if (error) throw error;
      base = (data || []).map((r) => ({
        id: r.code,
        name: r.name,
        emoji: r.emoji,
        description: r.description || "",
        game_mode: r.game_mode || "classic",
        color: "var(--accent)",
        gradient: "linear-gradient(135deg,rgba(62,207,255,.12),transparent)",
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
      .sort((a, b) => b.online - a.online);

    const totalOnline = Object.values(roomGames).reduce(
      (acc, g) =>
        acc + Object.values(g.players).filter((p) => !p._dcTimer).length,
      0,
    );

    return json({ rooms: result, totalOnline });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
