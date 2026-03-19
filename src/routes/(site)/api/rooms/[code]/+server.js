import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { customRooms, dbRooms } from "$lib/server/state.js";
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
      "id, code, name, emoji, description, is_public, auto_start, max_rounds, round_duration, break_duration, playlist_id, profiles!owner_id(username)",
    )
    .eq("code", code)
    .single();
  if (error || !data)
    return json({ error: "Room introuvable" }, { status: 404 });
  return json({ source: "db", ...data });
}

export async function PATCH({ params, request }) {
  const { user, token } = await requireAuth(request);
  const body = await request.json();
  const allowed = [
    "name",
    "emoji",
    "description",
    "playlist_id",
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
  const { error } = await userClient(token)
    .from("rooms")
    .update(updates)
    .eq("id", params.code);
  if (error) return json({ error: error.message }, { status: 400 });
  // Invalidate the in-memory room cache so the next join fetches fresh config
  const cachedCode = Object.keys(dbRooms).find(
    (k) => dbRooms[k]?.id === params.code,
  );
  if (cachedCode) delete dbRooms[cachedCode];
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
