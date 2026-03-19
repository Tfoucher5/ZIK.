import { fail } from "@sveltejs/kit";
import { getSupabaseServerClient } from "$lib/supabaseServer";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const nom = String(data.get("nom") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const website = String(data.get("website") ?? "").trim();

    if (website) {
      return {
        success: true,
        message: "Ton message a bien été envoyé !",
      };
    }

    const values = { nom, email, message };

    if (!nom || !email || !message) {
      return fail(400, {
        success: false,
        error: "Tous les champs sont obligatoires.",
        values,
      });
    }

    if (!isValidEmail(email)) {
      return fail(400, {
        success: false,
        error: "Adresse email invalide.",
        values,
      });
    }

    if (nom.length > 120) {
      return fail(400, {
        success: false,
        error: "Le nom est trop long.",
        values,
      });
    }

    if (message.length < 10) {
      return fail(400, {
        success: false,
        error: "Le message est trop court.",
        values,
      });
    }

    if (message.length > 5000) {
      return fail(400, {
        success: false,
        error: "Le message est trop long.",
        values,
      });
    }

    try {
      const supabase = getSupabaseServerClient();

      const { data: fnData, error } = await supabase.functions.invoke(
        "send-contact",
        {
          body: {
            nom,
            email,
            message,
            source: "Portfolio",
          },
        },
      );

      if (error) {
        console.error(error);
        throw error;
      }

      return {
        success: true,
        message: "Ton message a bien été envoyé !",
      };
    } catch (err) {
      console.error("Invoke error:", err);

      return fail(500, {
        success: false,
        error: "Une erreur est survenue lors de l’envoi du message.",
        values,
      });
    }
  },
};
