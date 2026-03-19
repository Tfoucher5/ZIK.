import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { verifyToken, userClient } from "$lib/server/middleware/auth.js";
import { playlistCache } from "$lib/server/state.js";

export async function POST({ params, request }) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return json({ error: "Non authentifi\u00e9" }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: "Session invalide" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin")
    return json({ error: "Super-admin uniquement" }, { status: 403 });

  const { is_official, linked_room_id } = await request.json();
  const { error } = await userClient(token)
    .from("custom_playlists")
    .update({
      is_official: !!is_official,
      linked_room_id: linked_room_id || null,
    })
    .eq("id", params.id);
  if (error) return json({ error: error.message }, { status: 400 });

  if (linked_room_id && is_official) delete playlistCache[linked_room_id];
  return json({ ok: true });
}
