import { fail } from '@sveltejs/kit';
import { RESEND_API_KEY, CONTACT_TO_EMAIL } from '$env/static/private';
import { Resend } from 'resend';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const actions = {
    default: async ({ request, getClientAddress }) => {
        const data = await request.formData();

        const nom = String(data.get('nom') ?? '').trim();
        const email = String(data.get('email') ?? '').trim();
        const message = String(data.get('message') ?? '').trim();

        // Honeypot anti-spam
        const website = String(data.get('website') ?? '').trim();

        if (website) {
            return {
                success: true,
                message: 'Ton message a bien été envoyé !'
            };
        }

        const values = { nom, email, message };

        if (!nom || !email || !message) {
            return fail(400, {
                success: false,
                error: 'Tous les champs sont obligatoires.',
                values
            });
        }

        if (!isValidEmail(email)) {
            return fail(400, {
                success: false,
                error: 'Adresse email invalide.',
                values
            });
        }

        if (nom.length > 120) {
            return fail(400, {
                success: false,
                error: 'Le nom est trop long.',
                values
            });
        }

        if (message.length < 10) {
            return fail(400, {
                success: false,
                error: 'Le message est trop court.',
                values
            });
        }

        if (message.length > 5000) {
            return fail(400, {
                success: false,
                error: 'Le message est trop long.',
                values
            });
        }

        if (!resend || !CONTACT_TO_EMAIL) {
            console.error('Configuration email manquante : RESEND_API_KEY ou CONTACT_TO_EMAIL absent.');
            return fail(500, {
                success: false,
                error: 'Le service email n’est pas correctement configuré.',
                values
            });
        }

        try {
            const safeNom = escapeHtml(nom);
            const safeEmail = escapeHtml(email);
            const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
            const clientIp = escapeHtml(getClientAddress?.() ?? 'inconnue');

            await resend.emails.send({
                // Remplace par ton domaine vérifié si tu en as un, ex:
                // from: 'Portfolio <contact@ton-domaine.fr>',
                from: 'Portfolio Contact <onboarding@resend.dev>',
                to: CONTACT_TO_EMAIL,
                replyTo: email,
                subject: `Nouveau message portfolio de ${nom}`,
                html: `
                    <div style="font-family: Inter, Arial, sans-serif; padding: 24px; background: #f8fafc; color: #0f172a;">
                        <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden;">
                            <div style="padding: 20px 24px; background: linear-gradient(135deg, #0f172a 0%, #111827 100%); color: #e2e8f0;">
                                <div style="font-size: 12px; opacity: 0.8; letter-spacing: 0.08em; text-transform: uppercase;">Portfolio Contact</div>
                                <h2 style="margin: 8px 0 0; font-size: 24px; line-height: 1.2;">Nouveau message reçu</h2>
                            </div>

                            <div style="padding: 24px;">
                                <div style="margin-bottom: 18px;">
                                    <p style="margin: 0 0 8px;"><strong>Nom :</strong> ${safeNom}</p>
                                    <p style="margin: 0 0 8px;"><strong>Email :</strong> <a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a></p>
                                    <p style="margin: 0;"><strong>IP :</strong> ${clientIp}</p>
                                </div>

                                <div style="margin-top: 20px; padding: 18px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0;">
                                    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; margin-bottom: 10px;">Message</div>
                                    <p style="margin: 0; line-height: 1.7; color: #0f172a;">${safeMessage}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            });

            return {
                success: true,
                message: 'Ton message a bien été envoyé !'
            };
        } catch (error) {
            console.error('Erreur Resend:', error);

            return fail(500, {
                success: false,
                error: 'Une erreur est survenue lors de l’envoi du message.',
                values
            });
        }
    }
};
``