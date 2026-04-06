import { getAdminClient } from "$lib/server/config.js";

export async function load({ url }) {
  const supabase = getAdminClient();
  const status = url.searchParams.get("status") || "pending";
  const type = url.searchParams.get("type") || "";

  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const { data: reports, error } = await query;
  const rows = reports || [];

  // Résoudre les noms de reporters et de rooms en parallèle
  const reporterIds = [...new Set(rows.filter((r) => r.reporter_id).map((r) => r.reporter_id))];
  const roomCodes = [...new Set(rows.filter((r) => r.room_id).map((r) => r.room_id))];

  const [profilesRes, roomsRes] = await Promise.all([
    reporterIds.length
      ? supabase.from("profiles").select("id, username").in("id", reporterIds)
      : { data: [] },
    roomCodes.length
      ? supabase.from("rooms").select("code, name, emoji").in("code", roomCodes)
      : { data: [] },
  ]);

  const profileMap = Object.fromEntries(
    (profilesRes.data || []).map((p) => [p.id, p]),
  );
  const roomMap = Object.fromEntries(
    (roomsRes.data || []).map((r) => [r.code, r]),
  );

  const enriched = rows.map((r) => ({
    ...r,
    resolved_username: profileMap[r.reporter_id]?.username || r.reporter_name || null,
    resolved_room: roomMap[r.room_id] || null,
  }));

  return {
    reports: enriched,
    filters: { status, type },
    error: error?.message || null,
  };
}

export const actions = {
  updateStatus: async ({ request }) => {
    const data = await request.formData();
    const id = data.get("id");
    const status = data.get("status");
    const note = data.get("admin_note") || null;

    if (!id || !["pending", "resolved", "dismissed"].includes(status)) {
      return { success: false };
    }

    const supabase = getAdminClient();
    await supabase
      .from("reports")
      .update({
        status,
        admin_note: note,
        resolved_at: status !== "pending" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    return { success: true };
  },
};
