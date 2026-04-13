import { error, redirect } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id) {
  if (!UUID_RE.test(id)) throw error(400, "ID invalide");
}

export async function load({ params }) {
  const sb = getAdminClient();
  assertUuid(params.id);

  const [playlistRes, tracksRes] = await Promise.all([
    sb
      .from("custom_playlists")
      .select("id, name, emoji, owner_id, is_public, is_official, track_count, created_at, updated_at, profiles!owner_id(username)")
      .eq("id", params.id)
      .single(),
    sb
      .from("custom_playlist_tracks")
      .select("id, playlist_id, artist, title, preview_url, cover_url, source, position, created_at")
      .eq("playlist_id", params.id)
      .order("position", { ascending: true }),
  ]);

  if (playlistRes.error || !playlistRes.data)
    throw error(404, "Playlist introuvable");

  return {
    playlist: playlistRes.data,
    tracks: tracksRes.data ?? [],
  };
}

export const actions = {
  deleteTrack: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const trackId = formData.get("track_id");
    const sb = getAdminClient();
    const { data: track } = await sb
      .from("custom_playlist_tracks")
      .select("artist, title")
      .eq("id", trackId)
      .single();
    const { error: err } = await sb
      .from("custom_playlist_tracks")
      .delete()
      .eq("id", trackId);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_track", params.id, "playlist", {
      track_id: trackId,
      artist: track?.artist,
      title: track?.title,
    });
    return { success: true };
  },

  reorderTrack: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const trackId = formData.get("track_id");
    const direction = formData.get("direction"); // 'up' | 'down'
    if (!["up", "down"].includes(direction))
      throw error(400, "Direction invalide");
    const sb = getAdminClient();
    const { data: tracks } = await sb
      .from("custom_playlist_tracks")
      .select("id, position")
      .eq("playlist_id", params.id)
      .order("position", { ascending: true });

    if (!tracks) return { success: false, error: "Tracks introuvables" };

    const idx = tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return { success: false, error: "Track introuvable" };

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tracks.length) return { success: true };

    const a = tracks[idx];
    const b = tracks[swapIdx];

    await sb
      .from("custom_playlist_tracks")
      .update({ position: b.position })
      .eq("id", a.id);
    await sb
      .from("custom_playlist_tracks")
      .update({ position: a.position })
      .eq("id", b.id);

    await logAdminAction(adminUser.id, "reorder_tracks", params.id, "playlist", {
      moved_track_id: trackId,
      direction,
      old_position: a.position,
      new_position: b.position,
    });
    return { success: true };
  },

  deletePlaylist: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    const { data: playlist } = await sb
      .from("custom_playlists")
      .select("name, track_count")
      .eq("id", params.id)
      .single();
    const { error: err } = await sb
      .from("custom_playlists")
      .delete()
      .eq("id", params.id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_playlist", params.id, "playlist", {
      name: playlist?.name,
      track_count: playlist?.track_count,
    });
    redirect(302, "/admin/playlists");
  },
};
