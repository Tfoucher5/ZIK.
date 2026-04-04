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

  return {
    reports: reports || [],
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
