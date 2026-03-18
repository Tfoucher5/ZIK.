<script>
    import { enhance } from '$app/forms';

    export let form = null;

    let isSubmitting = false;

    const handleEnhance = () => {
        isSubmitting = true;
        return async ({ result, update }) => {
            await update({ reset: result.type === 'success' });
            isSubmitting = false;
        };
    };

    function reveal(node) {
        node.classList.add('reveal');
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        node.classList.add('visible');
                        observer.unobserve(node);
                    }
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(node);
        return { destroy() { observer.disconnect(); } };
    }
</script>

<section id="contact" class="section">
    <div class="section-header" use:reveal>
        <span class="kicker">Contact</span>
        <h2 class="section-title">Initialiser une connexion</h2>
        <p class="section-sub">Une alternance, une opportunité ou un échange ? Écris-moi ici.</p>
    </div>

    <div class="contact-layout" use:reveal style="--delay: 100ms">
        <!-- Info side -->
        <div class="info-col">
            <div class="info-card card">
                <h3 class="info-title">Restons en contact</h3>
                <p class="info-text">
                    Je réponds généralement sous 24–48h.
                </p>

                <div class="contact-links">
                    <a href="https://www.linkedin.com/in/theo-foucher-3956b52a0/" target="_blank" rel="noopener noreferrer" class="contact-link">
                        <span class="link-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                        </span>
                        LinkedIn
                    </a>
                    <a href="https://github.com/Tfoucher5" target="_blank" rel="noopener noreferrer" class="contact-link">
                        <span class="link-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.09.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                        </span>
                        GitHub
                    </a>
                </div>
            </div>
        </div>

        <!-- Form side -->
        <div class="form-col">
            <div class="form-card card">
                <form method="POST" use:enhance={handleEnhance} class="contact-form">
                    <!-- Honeypot anti-spam -->
                    <div class="hidden-field" aria-hidden="true">
                        <label for="website">Website</label>
                        <input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
                    </div>

                    <div class="field-row">
                        <div class="input-group">
                            <input
                                id="nom"
                                type="text"
                                name="nom"
                                placeholder=" "
                                required
                                disabled={isSubmitting}
                                value={form?.values?.nom ?? ''}
                            />
                            <label for="nom">Votre nom</label>
                        </div>

                        <div class="input-group">
                            <input
                                id="email"
                                type="email"
                                name="email"
                                placeholder=" "
                                required
                                disabled={isSubmitting}
                                value={form?.values?.email ?? ''}
                            />
                            <label for="email">Votre email</label>
                        </div>
                    </div>

                    <div class="input-group">
                        <textarea
                            id="message"
                            name="message"
                            placeholder=" "
                            rows="6"
                            required
                            disabled={isSubmitting}
                        >{form?.values?.message ?? ''}</textarea>
                        <label for="message">Votre message</label>
                    </div>

                    <button class="submit-btn" type="submit" disabled={isSubmitting}>
                        {#if isSubmitting}
                            <span class="spinner" aria-hidden="true"></span> Transmission...
                        {:else}
                            Envoyer le message
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        {/if}
                    </button>
                </form>

                {#if form?.success}
                    <div class="status-msg success" role="status">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                        {form.message}
                    </div>
                {:else if form?.error}
                    <div class="status-msg error" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        {form.error}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</section>

<style>
    .section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 5rem 1.5rem 7rem;
    }

    .section-header {
        margin-bottom: 2.5rem;
    }

    .kicker {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6366f1;
        margin-bottom: 0.7rem;
    }

    .section-title {
        margin: 0 0 0.4rem;
        font-size: clamp(1.8rem, 4vw, 2.4rem);
        letter-spacing: -0.04em;
        color: #f1f5f9;
        font-weight: 800;
    }

    .section-sub {
        margin: 0;
        font-size: 0.9rem;
        color: #475569;
    }

    .contact-layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 1.2rem;
        align-items: start;
        max-width: 860px;
    }

    .card {
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(12px);
    }

    .info-card {
        padding: 1.6rem;
    }

    .info-title {
        margin: 0 0 0.8rem;
        font-size: 1rem;
        font-weight: 700;
        color: #e2e8f0;
    }

    .info-text {
        margin: 0 0 1.4rem;
        font-size: 0.88rem;
        line-height: 1.75;
        color: #64748b;
    }

    .contact-links {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .contact-link {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.6rem 0.85rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.02);
        color: #94a3b8;
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 500;
        transition: color 0.2s, border-color 0.2s, background 0.2s;
    }

    .contact-link:hover {
        color: #f1f5f9;
        border-color: rgba(99, 102, 241, 0.2);
        background: rgba(99, 102, 241, 0.05);
    }

    .link-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.04);
    }

    /* Form */
    .form-card {
        padding: 1.6rem;
    }

    .hidden-field {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
    }

    .contact-form {
        display: grid;
        gap: 1rem;
    }

    .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .input-group {
        position: relative;
    }

    .input-group input,
    .input-group textarea {
        width: 100%;
        padding: 1.15rem 0.95rem 0.65rem;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(255, 255, 255, 0.03);
        color: #f1f5f9;
        font: inherit;
        font-size: 0.92rem;
        transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        resize: vertical;
    }

    .input-group textarea {
        padding-top: 1.3rem;
    }

    .input-group input:focus,
    .input-group textarea:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.4);
        background: rgba(99, 102, 241, 0.04);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
    }

    .input-group label {
        position: absolute;
        left: 0.95rem;
        top: 0.95rem;
        font-size: 0.9rem;
        color: #475569;
        pointer-events: none;
        transition: top 0.18s, font-size 0.18s, color 0.18s;
    }

    .input-group input:focus ~ label,
    .input-group input:not(:placeholder-shown) ~ label,
    .input-group textarea:focus ~ label,
    .input-group textarea:not(:placeholder-shown) ~ label {
        top: 0.38rem;
        font-size: 0.7rem;
        color: #6366f1;
    }

    .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.9rem 1.5rem;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #818cf8, #6366f1 50%, #4f46e5);
        color: #f8fafc;
        font: inherit;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4), 0 8px 20px rgba(99, 102, 241, 0.2);
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.5), 0 12px 28px rgba(99, 102, 241, 0.28);
    }

    .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .status-msg {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-top: 0.8rem;
        padding: 0.85rem 1rem;
        border-radius: 10px;
        font-size: 0.88rem;
        font-weight: 500;
    }

    .status-msg.success {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.18);
        color: #6ee7b7;
    }

    .status-msg.error {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.16);
        color: #fca5a5;
    }

    @media (max-width: 760px) {
        .contact-layout {
            grid-template-columns: 1fr;
        }

        .field-row {
            grid-template-columns: 1fr;
        }
    }
</style>
