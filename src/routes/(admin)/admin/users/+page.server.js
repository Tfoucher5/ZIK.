import { getAdminClient } from "$lib/server/config.js";

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sort = url.searchParams.get("sort") || "elo";
  const order = url.searchParams.get("order") || "desc";
  const PAGE_SIZE = 50;

  let query = sb
    .from("profiles")
    .select("id, username, avatar_url, role, xp, level, elo, games_played, created_at, is_private", { count: "exact" })
    .order(sort, { ascending: order === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("username", `%${q}%`);

  const { data: users, count, error } = await query;

  return {
    users: users || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    sort,
    order,
    error: error?.message || null,
  };
}
