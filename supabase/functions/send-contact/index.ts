import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function escapeHtml(value: string = '') {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {

  try {

    const { nom, email, message, source } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL");

    const safeNom = escapeHtml(nom);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({

        from: "Portfolio <contact@zik-music.fr>",
        to: [CONTACT_TO_EMAIL],
        reply_to: safeEmail,
        subject: `Nouveau message (${source}) de ${safeNom}`,

        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:30px">
            <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
              
              <h2 style="margin-top:0;color:#0f172a">
                Nouveau message depuis ${source}
              </h2>

              <p style="margin:8px 0">
                <strong>Nom :</strong> ${safeNom}
              </p>

              <p style="margin:8px 0">
                <strong>Email :</strong> 
                  ${safeEmail}
                </a>
              </p>

              <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0"/>

              <div style="background:#f1f5f9;padding:16px;border-radius:8px">
                <p style="margin:0;color:#0f172a;line-height:1.6">
                  ${safeMessage}
                </p>
              </div>

              <p style="font-size:12px;color:#64748b;margin-top:20px">
                Envoyé depuis le formulaire ${source}
              </p>

            </div>
          </div>
        `,

        text: `
Nom: ${nom}
Email: ${email}

Message:
${message}
`
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      throw new Error("Resend failed");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {

    console.error(err);

    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});