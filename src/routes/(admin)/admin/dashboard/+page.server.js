import { getAdminClient } from "$lib/server/config.js";

export async function load() {
  const sb = getAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: gamesToday },
    { count: publicRooms },
    { count: pendingReports },
    { count: officialPlaylists },
    activeUsersRes,
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb.from("games").select("*", { count: "exact", head: true }).gte("started_at", today.toISOString()),
    sb.from("rooms").select("*", { count: "exact", head: true }).eq("is_public", true),
    sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("custom_playlists").select("*", { count: "exact", head: true }).eq("is_official", true),
    sb.from("game_players")
      .select("user_id", { count: "exact", head: true })
      .gte("games.started_at", sevenDaysAgo)
      .not("user_id", "is", null),
  ]);

  const uptimeSeconds = Math.floor(process.uptime());
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;
  const uptime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return {
    stats: {
      totalUsers: totalUsers ?? 0,
      gamesToday: gamesToday ?? 0,
      publicRooms: publicRooms ?? 0,
      pendingReports: pendingReports ?? 0,
      officialPlaylists: officialPlaylists ?? 0,
      activeUsers7d: activeUsersRes.count ?? 0,
      uptime,
    },
  };
}
