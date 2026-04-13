import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id) {
  if (!UUID_RE.test(id)) throw error(400, "ID invalide");
}

const ALLOWED_SORT = ["last_active_at", "created_at", "name"];
const ALLOWED_FLAGS = ["is_official", "is_public"];
const PAGE_SIZE = 50;

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sortParam = url.searchParams.get("sort");
  const sort = ALLOWED_SORT.includes(sortParam) ? sortParam : "last_active_at";

  let query = sb
    .from("rooms")
    .select(
      "id, code, name, emoji, description, owner_id, is_public, is_official, auto_start, max_rounds, round_duration, break_duration, created_at, last_active_at, profiles!owner_id(username)",
      { count: "exact" },
    )
    .order(sort, { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data: rooms, count, error: err } = await query;

  return {
    rooms: rooms || [],
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
    assertUuid(id);
    const field = formData.get("field");
    const value = formData.get("value") === "true";
    if (!ALLOWED_FLAGS.includes(field)) throw error(400, "Champ invalide");
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("rooms")
      .update({ [field]: value })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "toggle_room_flag", id, "room", {
      field,
      value,
    });
    return { success: true };
  },

  editRoom: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    assertUuid(id);
    const name = formData.get("name")?.trim();
    const emoji = formData.get("emoji")?.trim() || "🎵";
    const description = formData.get("description")?.trim() || null;
    const max_rounds = Math.min(
      50,
      Math.max(3, parseInt(formData.get("max_rounds"), 10) || 10),
    );
    const round_duration = Math.min(
      60,
      Math.max(10, parseInt(formData.get("round_duration"), 10) || 30),
    );
    const break_duration = Math.min(
      15,
      Math.max(3, parseInt(formData.get("break_duration"), 10) || 7),
    );
    const auto_start = formData.get("auto_start") === "on";
    if (!name || name.length < 1 || name.length > 60)
      return { success: false, error: "Nom invalide (1-60 chars)" };
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("rooms")
      .update({
        name,
        emoji,
        description,
        max_rounds,
        round_duration,
        break_duration,
        auto_start,
      })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_room", id, "room", {
      name,
      emoji,
      description,
      max_rounds,
      round_duration,
      break_duration,
      auto_start,
    });
    return { success: true };
  },

  deleteRoom: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    assertUuid(id);
    const sb = getAdminClient();
    const { data: room } = await sb
      .from("rooms")
      .select("code, name")
      .eq("id", id)
      .single();
    if (!room) return { success: false, error: "Room introuvable" };
    const { error: err } = await sb.from("rooms").delete().eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_room", id, "room", {
      code: room?.code,
      name: room?.name,
    });
    return { success: true };
  },
};
