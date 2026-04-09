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
  const reporterIds = [
    ...new Set(rows.filter((r) => r.reporter_id).map((r) => r.reporter_id)),
  ];
  const roomCodes = [
    ...new Set(rows.filter((r) => r.room_id).map((r) => r.room_id)),
  ];

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
    resolved_username:
      profileMap[r.reporter_id]?.username || r.reporter_name || null,
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
    const reply = data.get("admin_reply") || null;

    if (!id || !["pending", "resolved", "dismissed"].includes(status)) {
      return { success: false };
    }

    const supabase = getAdminClient();

    const { data: report } = await supabase
      .from("reports")
      .select("reporter_email, reporter_name, type, subject, admin_reply")
      .eq("id", id)
      .single();

    await supabase
      .from("reports")
      .update({
        status,
        admin_note: note,
        admin_reply: reply,
        resolved_at: status !== "pending" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    const newReply = reply?.trim();
    const oldReply = report?.admin_reply?.trim();
    if (newReply && newReply !== oldReply) {
      const recipientEmail = report?.reporter_email || null;

      if (recipientEmail) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        await fetch(`${supabaseUrl}/functions/v1/send-reply`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reporter_email: recipientEmail,
            reporter_name: report.reporter_name,
            admin_reply: newReply,
            report_type: report.type,
            report_subject: report.subject,
          }),
        }).catch((err) => console.error("send-reply failed:", err));
      }
    }

    return { success: true };
  },

  sendReply: async ({ request }) => {
    const data = await request.formData();
    const id = data.get("id");
    const reply = data.get("admin_reply")?.trim();

    if (!id || !reply) return { success: false, error: "Champs manquants" };

    const supabase = getAdminClient();

    const { data: report } = await supabase
      .from("reports")
      .select("reporter_email, reporter_name, type, subject")
      .eq("id", id)
      .single();

    if (!report?.reporter_email)
      return { success: false, error: "Pas d'email" };

    // Sauvegarder la réponse en BDD sans changer le statut
    await supabase.from("reports").update({ admin_reply: reply }).eq("id", id);

    // Envoyer le mail
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const res = await fetch(`${supabaseUrl}/functions/v1/send-reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reporter_email: report.reporter_email,
        reporter_name: report.reporter_name,
        admin_reply: reply,
        report_type: report.type,
        report_subject: report.subject,
      }),
    }).catch((err) => {
      console.error("send-reply failed:", err);
      return null;
    });

    const ok = res?.ok ?? false;
    return { success: ok, sent: ok };
  },
};
