import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";

let _cache = null;
let _cacheExp = 0;

export async function GET() {
  if (_cache && _cacheExp > Date.now()) return json(_cache);

  try {
    const [{ count: users }, { count: publicRooms }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true),
    ]);

    _cache = { users: users ?? 0, publicRooms: publicRooms ?? 0 };
    _cacheExp = Date.now() + 60_000; // cache 1 min
    return json(_cache);
  } catch {
    return json({ users: 0, publicRooms: 0 }, { status: 500 });
  }
}
