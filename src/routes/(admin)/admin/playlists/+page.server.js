import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const ALLOWED_SORT = ["track_count", "created_at", "name"];
const ALLOWED_FLAGS = ["is_official", "is_public"];
const PAGE_SIZE = 50;

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sortParam = url.searchParams.get("sort");
  const sort = ALLOWED_SORT.includes(sortParam) ? sortParam : "track_count";

  let query = sb
    .from("custom_playlists")
    .select(
      "id, name, emoji, owner_id, is_public, is_official, track_count, created_at, profiles!owner_id(username)",
      { count: "exact" },
    )
    .order(sort, { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: playlists, count, error: err } = await query;

  return {
    playlists: playlists || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    sort,
    error: err?.message || null,
  };
}

export const actions = {
  toggleFlag: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const field = formData.get("field");
    const value = formData.get("value") === "true";
    if (!ALLOWED_FLAGS.includes(field)) throw error(400, "Champ invalide");
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("custom_playlists")
      .update({ [field]: value })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "toggle_playlist_flag", id, "playlist", {
      field,
      value,
    });
    return { success: true };
  },

  editPlaylist: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const name = formData.get("name")?.trim();
    const emoji = formData.get("emoji")?.trim() || "🎵";
    if (!name || name.length < 1)
      return { success: false, error: "Nom invalide" };
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("custom_playlists")
      .update({ name, emoji })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_playlist", id, "playlist", {
      name,
      emoji,
    });
    return { success: true };
  },

  deletePlaylist: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const sb = getAdminClient();
    const { data: playlist } = await sb
      .from("custom_playlists")
      .select("name, track_count")
      .eq("id", id)
      .single();
    const { error: err } = await sb
      .from("custom_playlists")
      .delete()
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_playlist", id, "playlist", {
      name: playlist?.name,
      track_count: playlist?.track_count,
    });
    return { success: true };
  },
};
