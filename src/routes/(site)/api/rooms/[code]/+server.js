import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { customRooms, dbRooms, playlistCache } from "$lib/server/state.js";
import { requireAuth, userClient } from "$lib/server/middleware/auth.js";

export async function GET({ params }) {
  const code = params.code.toUpperCase();
  const ephemeral = customRooms[code];
  if (ephemeral) {
    return json({
      source: "ephemeral",
      name: ephemeral.name,
      emoji: ephemeral.emoji,
      maxRounds: ephemeral.maxRounds,
      trackCount: ephemeral.tracks.length,
    });
  }
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, code, name, emoji, description, is_public, auto_start, max_rounds, round_duration, break_duration, playlist_id, profiles!owner_id(username), room_playlists(playlist_id, position)",
    )
    .eq("code", code)
    .single();
  if (error || !data)
    return json({ error: "Room introuvable" }, { status: 404 });

  const playlist_ids =
    data.room_playlists?.length > 0
      ? data.room_playlists
          .sort((a, b) => a.position - b.position)
          .map((rp) => rp.playlist_id)
      : data.playlist_id
        ? [data.playlist_id]
        : [];

  return json({ source: "db", ...data, playlist_ids });
}

export async function PATCH({ params, request }) {
  const { user, token } = await requireAuth(request);
  const body = await request.json();
  const allowed = [
    "name",
    "emoji",
    "description",
    "is_public",
    "auto_start",
    "max_rounds",
    "round_duration",
    "break_duration",
  ];
  const updates = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  if (updates.name) updates.name = String(updates.name).trim().slice(0, 60);

  // Gérer playlist_ids si fourni
  const playlist_ids = body.playlist_ids;
  if (playlist_ids !== undefined) {
    if (!Array.isArray(playlist_ids) || playlist_ids.length === 0)
      return json({ error: "Au moins une playlist requise" }, { status: 400 });
    updates.playlist_id = playlist_ids[0];
  }

  const { error } = await userClient(token)
    .from("rooms")
    .update(updates)
    .eq("id", params.code);
  if (error) return json({ error: error.message }, { status: 400 });

  // Mettre à jour room_playlists si playlist_ids fourni
  if (playlist_ids !== undefined) {
    await supabase.from("room_playlists").delete().eq("room_id", params.code);
    const links = playlist_ids.map((pid, i) => ({
      room_id: params.code,
      playlist_id: pid,
      position: i,
    }));
    await supabase.from("room_playlists").insert(links);
  }

  // Invalider le cache mémoire (config + playlist)
  const cachedCode = Object.keys(dbRooms).find(
    (k) => dbRooms[k]?.id === params.code,
  );
  if (cachedCode) {
    delete dbRooms[cachedCode];
    delete playlistCache[cachedCode];
  }

  return json({ ok: true });
}

export async function DELETE({ params, request }) {
  const { token } = await requireAuth(request);
  const { error } = await userClient(token)
    .from("rooms")
    .delete()
    .eq("id", params.code);
  if (error) return json({ error: error.message }, { status: 400 });
  return json({ ok: true });
}
