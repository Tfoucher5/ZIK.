import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";

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
const _cache = makeCache(60_000);

export async function GET() {
  const cached = _cache.get();
  if (cached) return json(cached);
  const { data, error } = await supabase.rpc("weekly_leaderboard");
  if (error) return json({ error: error.message }, { status: 500 });

  // Enrich top entries with avatar_url from profiles
  if (data && data.length > 0) {
    const usernames = data.slice(0, 10).map((r) => r.username);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .in("username", usernames);
    if (profiles) {
      const avatarMap = Object.fromEntries(profiles.map((p) => [p.username, p.avatar_url]));
      data.forEach((r) => { r.avatar_url = avatarMap[r.username] ?? null; });
    }
  }

  _cache.set(data);
  return json(data);
}
