import { json } from "@sveltejs/kit";
import { requireAuth, userClient } from "$lib/server/middleware/auth.js";
import { roomGames } from "$lib/server/state.js";

export async function GET({ request }) {
  const { user, token } = await requireAuth(request);
  const { data, error } = await userClient(token)
    .from("rooms")
    .select(
      "id, code, name, emoji, description, is_public, auto_start, max_rounds, round_duration, break_duration, last_active_at, playlist_id, custom_playlists!playlist_id(track_count), room_playlists(playlist_id, position, custom_playlists(id, name, emoji, track_count))",
    )
    .eq("owner_id", user.id)
    .order("last_active_at", { ascending: false });
  if (error) return json({ error: error.message }, { status: 400 });

  const result = (data || []).map((r) => {
    const online = Object.values(roomGames)
      .filter((g) => g.roomId === r.code)
      .reduce(
        (acc, g) =>
          acc + Object.values(g.players).filter((p) => !p._dcTimer).length,
        0,
      );

    const playlists =
      r.room_playlists?.length > 0
        ? r.room_playlists
            .sort((a, b) => a.position - b.position)
            .map((rp) => rp.custom_playlists)
            .filter(Boolean)
        : r.custom_playlists
          ? [r.custom_playlists]
          : [];

    const track_count = playlists.reduce(
      (sum, pl) => sum + (pl?.track_count || 0),
      0,
    );

    const playlist_ids =
      r.room_playlists?.length > 0
        ? r.room_playlists
            .sort((a, b) => a.position - b.position)
            .map((rp) => rp.playlist_id)
        : r.playlist_id
          ? [r.playlist_id]
          : [];

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      emoji: r.emoji,
      description: r.description,
      is_public: r.is_public,
      auto_start: r.auto_start,
      max_rounds: r.max_rounds,
      round_duration: r.round_duration,
      break_duration: r.break_duration,
      last_active_at: r.last_active_at,
      playlists,
      playlist_ids,
      track_count,
      online,
    };
  });

  return json(result);
}
