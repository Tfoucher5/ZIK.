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
    const { reporter_email, reporter_name, admin_reply, report_type, report_subject } =
      await req.json();

    if (!reporter_email || !admin_reply) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const typeLabel: Record<string, string> = {
      bug: "Bug",
      user: "Signalement",
      contact: "Contact",
    };
    const label = typeLabel[report_type] ?? report_type ?? "Report";

    const safeName = escapeHtml(reporter_name || reporter_email);
    const safeReply = escapeHtml(admin_reply).replace(/\n/g, "<br/>");
    const safeSubject = report_subject ? escapeHtml(report_subject) : null;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:30px">
        <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <h2 style="margin-top:0;color:#0f172a">Réponse à ton ${label}</h2>

          <p style="margin:8px 0;color:#475569">Bonjour ${safeName},</p>
          <p style="margin:8px 0;color:#475569">L'équipe ZIK a répondu à ton signalement${safeSubject ? ` (<em>${safeSubject}</em>)` : ""} :</p>

          <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0"/>

          <div style="background:#f1f5f9;padding:16px;border-radius:8px">
            <p style="margin:0;color:#0f172a;line-height:1.6">${safeReply}</p>
          </div>

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
        from: "ZIK <theo@zik-music.fr>",
        reply_to: "theo@zik-music.fr",
        to: [reporter_email],
        subject: `[ZIK] Réponse à ton ${label}`,
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
