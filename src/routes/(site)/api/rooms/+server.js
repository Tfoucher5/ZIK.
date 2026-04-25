import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import { roomGames } from "$lib/server/state.js";
import {
  requireAuth,
  verifyToken,
  userClient,
  checkRateLimit,
} from "$lib/server/middleware/auth.js";

export async function GET({ request }) {
  const token = request.headers.get("authorization")?.slice(7);
  let isSuperAdmin = false;

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isSuperAdmin = p?.role === "super_admin";
    }
  }

  let query = supabase
    .from("rooms")
    .select(
      "id, code, name, emoji, description, is_public, is_official, auto_start, game_mode, max_rounds, round_duration, break_duration, last_active_at, owner_id, playlist_id, profiles!owner_id(username, avatar_url), custom_playlists!playlist_id(track_count), room_playlists(playlist_id, position, custom_playlists(id, name, emoji, track_count))",
    )
    .order("last_active_at", { ascending: false })
    .limit(50);

  if (!isSuperAdmin) query = query.eq("is_public", true);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, { status: 400 });

  const result = (data || []).map((r) => {
    // Nombre de joueurs en live
    const online = Object.values(roomGames)
      .filter((g) => g.roomId === r.code)
      .reduce(
        (acc, g) =>
          acc + Object.values(g.players).filter((p) => !p._dcTimer).length,
        0,
      );

    // Playlists liées (new system) ou fallback sur playlist_id
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
      is_official: r.is_official,
      auto_start: r.auto_start,
      game_mode: r.game_mode || "classic",
      max_rounds: r.max_rounds,
      round_duration: r.round_duration,
      break_duration: r.break_duration,
      last_active_at: r.last_active_at,
      owner_id: r.owner_id,
      profiles: r.profiles,
      playlists,
      playlist_ids,
      track_count,
      online,
    };
  });

  return json(result);
}

export async function POST({ request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 10, 60_000);
  const { user, token } = await requireAuth(request);

  const body = await request.json();
  const {
    name,
    emoji,
    description,
    playlist_ids,
    is_public,
    max_rounds,
    round_duration,
    break_duration,
    auto_start,
    game_mode,
  } = body || {};
  if (!name?.trim()) return json({ error: "name requis" }, { status: 400 });
  if (!playlist_ids?.length)
    return json({ error: "Au moins une playlist requise" }, { status: 400 });

  const { data, error } = await userClient(token)
    .from("rooms")
    .insert({
      name: String(name).trim().slice(0, 60),
      emoji: emoji || "🎵",
      description: String(description || "").slice(0, 200),
      owner_id: user.id,
      playlist_id: playlist_ids[0] || null,
      is_public: is_public !== false,
      auto_start: auto_start === true,
      game_mode: game_mode === "qcm" ? "qcm" : "classic",
      max_rounds: Math.min(Math.max(parseInt(max_rounds) || 10, 3), 50),
      round_duration: Math.min(
        Math.max(parseInt(round_duration) || 30, 10),
        60,
      ),
      break_duration: Math.min(Math.max(parseInt(break_duration) || 7, 3), 15),
    })
    .select("id, code, name, emoji")
    .single();

  if (error) return json({ error: error.message }, { status: 400 });

  // Insérer les liaisons room <-> playlists
  const links = playlist_ids.map((pid, i) => ({
    room_id: data.id,
    playlist_id: pid,
    position: i,
  }));
  await supabase.from("room_playlists").insert(links);

  return json(data);
}
