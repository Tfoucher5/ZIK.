import { json } from "@sveltejs/kit";
import { verifyToken, userClient } from "$lib/server/middleware/auth.js";
import { parseFeaturing } from "$lib/server/services/playlist.js";
import { playlistCache, dbRooms } from "$lib/server/state.js";

async function getOwnedTrack(uSupa, trackId, userId) {
  const { data } = await uSupa
    .from("custom_playlist_tracks")
    .select(
      "playlist_id, artist, title, custom_artist, custom_title, custom_feats, custom_playlists(owner_id)",
    )
    .eq("id", trackId)
    .single();
  if (data?.custom_playlists?.owner_id !== userId) return null;
  return data;
}

// GET /api/playlists/tracks/[trackId]/answers
// Retourne les valeurs actuelles (custom si définies, défaut sinon) + les défauts pour pré-remplir
export async function GET({ params, request }) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return json({ error: "Non authentifié" }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: "Session invalide" }, { status: 401 });

  const uSupa = userClient(token);
  const track = await getOwnedTrack(uSupa, params.trackId, user.id);
  if (!track) return json({ error: "Non autorisé" }, { status: 403 });

  const parsed = parseFeaturing(track.artist || "");
  const { data: extraRows } = await uSupa
    .from("track_answers")
    .select("answer_type_id, value")
    .eq("track_id", params.trackId);
  return json({
    custom_artist: track.custom_artist || null,
    custom_title: track.custom_title || null,
    custom_feats: track.custom_feats || null,
    default_artist: parsed.main,
    default_feats: parsed.feats,
    default_title: track.title,
    extra_answers: extraRows || [],
  });
}

// PUT /api/playlists/tracks/[trackId]/answers
// Enregistre les overrides artiste / titre / feats
// Body: { custom_artist, custom_title, custom_feats }
export async function PUT({ params, request }) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) return json({ error: "Non authentifié" }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: "Session invalide" }, { status: 401 });

  const uSupa = userClient(token);
  const track = await getOwnedTrack(uSupa, params.trackId, user.id);
  if (!track) return json({ error: "Non autorisé" }, { status: 403 });

  const { custom_artist, custom_title, custom_feats, extra_answers } = await request.json();

  const feats =
    Array.isArray(custom_feats) && custom_feats.length
      ? custom_feats.map((f) => String(f).trim()).filter(Boolean)
      : null;

  const { error } = await uSupa
    .from("custom_playlist_tracks")
    .update({
      custom_artist: custom_artist?.trim() || null,
      custom_title: custom_title?.trim() || null,
      custom_feats: feats,
    })
    .eq("id", params.trackId);

  if (error) return json({ error: error.message }, { status: 400 });

  // Remplacer les réponses supplémentaires (Film, Série, etc.)
  await uSupa.from("track_answers").delete().eq("track_id", params.trackId);
  if (Array.isArray(extra_answers) && extra_answers.length) {
    const rows = extra_answers
      .filter((a) => a.type_id && a.value?.trim())
      .map((a) => ({
        track_id: params.trackId,
        answer_type_id: Number(a.type_id),
        value: String(a.value).trim(),
      }));
    if (rows.length) await uSupa.from("track_answers").insert(rows);
  }

  // Invalider le cache des rooms qui utilisent cette playlist
  if (track.playlist_id) {
    for (const [roomId, room] of Object.entries(dbRooms)) {
      if (room.playlist_id === track.playlist_id) {
        delete playlistCache[roomId];
      }
    }
  }

  return json({ ok: true });
}
