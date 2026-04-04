import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function escapeHtml(value: string = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  try {
    const {
      type,
      message,
      reporter_name,
      reporter_email,
      reported_username,
      room_id,
      subject,
      metadata,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL");

    if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const typeLabel: Record<string, string> = {
      bug: "🐛 Bug",
      user: "🚨 Signalement joueur",
      contact: "✉️ Contact",
    };
    const label = typeLabel[type] ?? type;

    const from = escapeHtml(reporter_name || reporter_email || "Anonyme");
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
    const metaStr =
      metadata && Object.keys(metadata).length
        ? `<p style="margin:8px 0"><strong>Contexte :</strong> <code>${escapeHtml(JSON.stringify(metadata))}</code></p>`
        : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:30px">
        <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <h2 style="margin-top:0;color:#0f172a">${label}</h2>

          <p style="margin:8px 0"><strong>De :</strong> ${from}</p>

          ${reported_username ? `<p style="margin:8px 0"><strong>Joueur signalé :</strong> ${escapeHtml(reported_username)}</p>` : ""}
          ${room_id ? `<p style="margin:8px 0"><strong>Room :</strong> ${escapeHtml(room_id)}</p>` : ""}
          ${subject ? `<p style="margin:8px 0"><strong>Objet :</strong> ${escapeHtml(subject)}</p>` : ""}

          <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0"/>

          <div style="background:#f1f5f9;padding:16px;border-radius:8px">
            <p style="margin:0;color:#0f172a;line-height:1.6">${safeMessage}</p>
          </div>

          ${metaStr}

          <p style="margin-top:20px">
            <a href="https://www.zik-music.fr/admin/reports" style="background:#6366f1;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
              Voir dans l'interface admin →
            </a>
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:20px">ZIK — zik-music.fr</p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ZIK <noreply@zik-music.fr>",
        to: [CONTACT_TO_EMAIL],
        subject: `[ZIK] Nouveau report — ${label}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error:", text);
      throw new Error("Resend failed");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
