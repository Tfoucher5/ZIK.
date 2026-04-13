import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id) {
  if (!UUID_RE.test(id)) throw error(400, "ID invalide");
}

export async function load({ params }) {
  const sb = getAdminClient();
  const { id } = params;
  assertUuid(id);

  const [profileRes, authUserRes, gamesRes, reportsRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).single(),
    sb.auth.admin.getUserById(id),
    sb
      .from("game_players")
      .select(
        "score, rank, is_guest, games(id, room_id, started_at, ended_at, rounds)",
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("reports")
      .select("*")
      .or(`reporter_id.eq.${id},reported_user_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profileRes.error || !profileRes.data)
    throw error(404, "User introuvable");

  const authUser = authUserRes.data?.user;
  const isBanned = authUser?.banned_until
    ? new Date(authUser.banned_until) > new Date()
    : false;

  return {
    profile: profileRes.data,
    isBanned,
    bannedUntil: authUser?.banned_until ?? null,
    games: gamesRes.data ?? [],
    reports: reportsRes.data ?? [],
  };
}

export const actions = {
  ban: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb.auth.admin.updateUserById(params.id, { ban_duration: "87600h" });
    await logAdminAction(adminUser.id, "ban_user", params.id, "user", {
      duration: "87600h",
    });
    return { success: true };
  },

  unban: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb.auth.admin.updateUserById(params.id, { ban_duration: "none" });
    await logAdminAction(adminUser.id, "unban_user", params.id, "user", {});
    return { success: true };
  },

  editStats: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const sb = getAdminClient();
    const xp = Math.max(0, parseInt(formData.get("xp"), 10) || 0);
    const elo = Math.max(
      0,
      Math.min(99999, parseInt(formData.get("elo"), 10) || 1000),
    );
    const level = Math.max(
      1,
      Math.min(1000, parseInt(formData.get("level"), 10) || 1),
    );
    await sb.from("profiles").update({ xp, elo, level }).eq("id", params.id);
    await logAdminAction(adminUser.id, "edit_stats", params.id, "user", {
      xp,
      elo,
      level,
    });
    return { success: true };
  },

  editUsername: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const sb = getAdminClient();
    const username = formData.get("username")?.trim();
    if (!username || username.length < 3)
      return { success: false, error: "Username invalide" };
    const { error: err } = await sb
      .from("profiles")
      .update({ username })
      .eq("id", params.id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_username", params.id, "user", {
      username,
    });
    return { success: true };
  },

  resetStats: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb
      .from("profiles")
      .update({
        xp: 0,
        elo: 1000,
        level: 1,
        games_played: 0,
        total_score: 0,
      })
      .eq("id", params.id);
    await logAdminAction(adminUser.id, "reset_stats", params.id, "user", {});
    return { success: true };
  },

  setRole: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    if (params.id === adminUser.id)
      return {
        success: false,
        error: "Impossible de modifier son propre rôle",
      };
    const role = formData.get("role");
    if (!["user", "super_admin"].includes(role)) return { success: false };
    const sb = getAdminClient();
    await sb.from("profiles").update({ role }).eq("id", params.id);
    await logAdminAction(adminUser.id, "set_role", params.id, "user", { role });
    return { success: true };
  },

  deleteUser: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const confirm = formData.get("confirm_username")?.trim();
    const sb = getAdminClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("username")
      .eq("id", params.id)
      .single();
    if (confirm !== profile?.username)
      return {
        success: false,
        error: "Username incorrect — suppression annulée",
      };
    await sb.auth.admin.deleteUser(params.id);
    await logAdminAction(adminUser.id, "delete_user", params.id, "user", {
      username: profile.username,
    });
    return { success: true, deleted: true };
  },
};
