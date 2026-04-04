<script>
  let { open = $bindable(false) } = $props();

  let name    = $state('');
  let email   = $state('');
  let subject = $state('');
  let message = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error   = $state('');

  async function submit() {
    if (!email.trim() || !message.trim()) { error = 'Email et message requis.'; return; }
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          reporter_name: name.trim() || null,
          reporter_email: email.trim(),
          subject: subject.trim() || null,
          message: message.trim(),
        }),
      });
      if (!res.ok) { const d = await res.json(); error = d.error || 'Erreur.'; }
      else { success = true; name = ''; email = ''; subject = ''; message = ''; }
    } catch { error = 'Erreur réseau.'; }
    finally { loading = false; }
  }

  function close() {
    open = false;
    success = false;
    error = '';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="cm-backdrop" onclick={close}>
    <div class="cm-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
      <button class="cm-close" onclick={close} aria-label="Fermer">&times;</button>

      {#if success}
        <div class="cm-success">
          <div class="cm-success-icon">✓</div>
          <h2>Message envoyé !</h2>
          <p>Merci, je te répondrai dès que possible.</p>
          <button class="cm-btn" onclick={close}>Fermer</button>
        </div>
      {:else}
        <h2 class="cm-title">Nous contacter</h2>
        <p class="cm-subtitle">Bug, question, collaboration — on est là.</p>

        <div class="cm-row">
          <div class="cm-field">
            <label for="cm-name">Prénom / pseudo</label>
            <input id="cm-name" type="text" bind:value={name} placeholder="Optionnel" maxlength="60">
          </div>
          <div class="cm-field">
            <label for="cm-email">Email <span class="cm-req">*</span></label>
            <input id="cm-email" type="email" bind:value={email} placeholder="toi@exemple.fr" maxlength="120">
          </div>
        </div>

        <div class="cm-field">
          <label for="cm-subject">Objet</label>
          <input id="cm-subject" type="text" bind:value={subject} placeholder="Ex : Bug sur la room Pop" maxlength="120">
        </div>

        <div class="cm-field">
          <label for="cm-message">Message <span class="cm-req">*</span></label>
          <textarea id="cm-message" bind:value={message} placeholder="Décris ton problème ou ta demande…" rows="5" maxlength="2000"></textarea>
        </div>

        {#if error}<p class="cm-error">{error}</p>{/if}

        <button class="cm-btn" onclick={submit} disabled={loading}>
          {loading ? 'Envoi…' : 'Envoyer →'}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
.cm-backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: cmFadeIn 0.2s ease;
}
@keyframes cmFadeIn { from { opacity: 0; } to { opacity: 1; } }

.cm-modal {
  background: var(--surface, #111827);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 20px;
  padding: 32px 28px 28px;
  width: 100%; max-width: 520px;
  position: relative;
  animation: cmSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes cmSlideIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to   { opacity: 1; transform: none; }
}

.cm-close {
  position: absolute; top: 14px; right: 16px;
  background: none; border: none; color: var(--mid, #6b7280);
  font-size: 1.4rem; cursor: pointer; line-height: 1;
  transition: color 0.15s;
}
.cm-close:hover { color: var(--text, #fff); }

.cm-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.4rem; font-weight: 800; margin-bottom: 4px;
}
.cm-subtitle { font-size: 0.85rem; color: var(--mid, #6b7280); margin-bottom: 22px; }

.cm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.cm-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.cm-field label { font-size: 0.78rem; font-weight: 600; color: var(--mid, #6b7280); }
.cm-req { color: var(--accent, #6366f1); }

.cm-field input, .cm-field textarea {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  padding: 11px 14px;
  color: var(--text, #fff);
  font-family: inherit; font-size: 0.9rem;
  outline: none; resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.cm-field input:focus, .cm-field textarea:focus {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 0 0 3px rgb(var(--accent-rgb, 99 102 241) / 0.15);
}
.cm-field textarea { min-height: 110px; }

.cm-error { color: var(--danger, #f87171); font-size: 0.82rem; margin-bottom: 10px; }

.cm-btn {
  width: 100%;
  background: linear-gradient(135deg, var(--accent, #6366f1), var(--accent2, #a78bfa));
  color: #fff; border: none;
  padding: 13px; border-radius: 50px;
  font-weight: 700; font-size: 0.95rem; font-family: inherit;
  cursor: pointer; transition: opacity 0.15s, transform 0.1s;
}
.cm-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.cm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.cm-success {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 12px; padding: 16px 0;
}
.cm-success-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(74,222,128,0.15); border: 2px solid rgba(74,222,128,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; color: #4ade80;
}
.cm-success h2 { font-family: "Bricolage Grotesque", sans-serif; font-size: 1.3rem; font-weight: 800; }
.cm-success p { color: var(--mid, #6b7280); font-size: 0.88rem; }
.cm-success .cm-btn { width: auto; padding: 11px 28px; margin-top: 4px; }

@media (max-width: 480px) {
  .cm-modal { padding: 24px 18px 20px; border-radius: 16px; }
  .cm-row { grid-template-columns: 1fr; gap: 0; }
}
</style>
