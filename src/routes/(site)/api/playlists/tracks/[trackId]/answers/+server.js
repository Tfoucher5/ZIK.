import { json } from "@sveltejs/kit";
import { verifyToken, userClient } from "$lib/server/middleware/auth.js";
import { playlistCache, dbRooms } from "$lib/server/state.js";

async function ownsTrack(uSupa, trackId, userId) {
  const { data } = await uSupa
    .from("custom_playlist_tracks")
    .select("playlist_id, custom_playlists(owner_id, linked_room_id)")
    .eq("id", trackId)
    .single();
  if (data?.custom_playlists?.owner_id !== userId) return { ok: false };
  return { ok: true, linked_room_id: data.custom_playlists.linked_room_id };
}

// GET /api/playlists/tracks/[trackId]/answers
// Retourne les réponses custom d'une track + la liste des types disponibles
export async function GET({ params, request }) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return json({ error: "Non authentifié" }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: "Session invalide" }, { status: 401 });

  const uSupa = userClient(token);
  const { trackId } = params;

  const ownership = await ownsTrack(uSupa, trackId, user.id);
  if (!ownership.ok) return json({ error: "Non autorisé" }, { status: 403 });

  const [{ data: answers }, { data: types }] = await Promise.all([
    uSupa
      .from("track_answers")
      .select("id, answer_type_id, value, answer_types(name)")
      .eq("track_id", trackId),
    uSupa.from("answer_types").select("id, name").order("id"),
  ]);

  return json({ answers: answers || [], types: types || [] });
}

// PUT /api/playlists/tracks/[trackId]/answers
// Remplace toutes les réponses de la track par le tableau fourni
// Body: { answers: [{ answer_type_id, value }] }
export async function PUT({ params, request }) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return json({ error: "Non authentifié" }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: "Session invalide" }, { status: 401 });

  const uSupa = userClient(token);
  const { trackId } = params;

  const ownership = await ownsTrack(uSupa, trackId, user.id);
  if (!ownership.ok) return json({ error: "Non autorisé" }, { status: 403 });

  const { answers } = await request.json();
  if (!Array.isArray(answers))
    return json({ error: "Format invalide" }, { status: 400 });

  const valid = answers.filter(
    (a) => a.answer_type_id && typeof a.value === "string" && a.value.trim(),
  );

  await uSupa.from("track_answers").delete().eq("track_id", trackId);

  if (valid.length) {
    const { error } = await uSupa.from("track_answers").insert(
      valid.map((a) => ({
        track_id: trackId,
        answer_type_id: a.answer_type_id,
        value: a.value.trim(),
      })),
    );
    if (error) return json({ error: error.message }, { status: 400 });
  }

  // Invalider le cache de toutes les rooms qui utilisent cette playlist
  const { data: trackRow } = await uSupa
    .from("custom_playlist_tracks")
    .select("playlist_id")
    .eq("id", trackId)
    .single();
  if (trackRow?.playlist_id) {
    for (const [roomId, room] of Object.entries(dbRooms)) {
      if (room.playlist_id === trackRow.playlist_id) {
        delete playlistCache[roomId];
      }
    }
  }

  return json({ ok: true });
}
