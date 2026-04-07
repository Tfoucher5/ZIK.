import { json } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function sendReportNotification(report) {
  if (!SUPABASE_URL) return;
  await fetch(`${SUPABASE_URL}/functions/v1/send-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(report),
  });
}

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON invalide" }, { status: 400 });
  }

  const {
    type,
    message,
    reporter_name,
    reporter_email,
    reporter_id,
    reported_user_id,
    reported_username,
    room_id,
    subject,
    metadata,
  } = body;

  if (!["bug", "user", "contact"].includes(type)) {
    return json({ error: "Type invalide" }, { status: 400 });
  }
  if (!message?.trim()) {
    return json({ error: "Message requis" }, { status: 400 });
  }
  if (type === "contact" && !reporter_email?.trim()) {
    return json({ error: "Email requis pour un contact" }, { status: 400 });
  }

  const supabase = getAdminClient();

  let resolvedEmail = reporter_email?.trim() || null;
  if (!resolvedEmail && reporter_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(reporter_id);
    resolvedEmail = authUser?.user?.email || null;
  }

  const { error } = await supabase.from("reports").insert({
    type,
    message: message.trim(),
    reporter_id: reporter_id || null,
    reporter_name: reporter_name?.trim() || null,
    reporter_email: resolvedEmail,
    reported_user_id: reported_user_id || null,
    reported_username: reported_username?.trim() || null,
    room_id: room_id || null,
    subject: subject?.trim() || null,
    metadata: metadata || {},
  });

  if (error) return json({ error: error.message }, { status: 500 });

  // Notif email via Edge Function Supabase (non bloquant)
  sendReportNotification({
    type,
    message,
    reporter_name,
    reporter_email,
    reported_username,
    room_id,
    subject,
    metadata,
  }).catch(() => {});

  return json({ ok: true });
}
