<script>
  /**
   * ReportModal — signalement joueur ou bug en jeu
   * Props:
   *   open            — bindable, contrôle l'affichage
   *   type            — 'user' | 'bug'
   *   reportedUsername — pré-rempli pour type='user'
   *   reportedUserId  — id Supabase du joueur signalé
   *   roomId          — code de la room courante
   *   reporterId      — userId de celui qui signale (null si invité)
   *   reporterName    — username de celui qui signale
   */
  let {
    open            = $bindable(false),
    type            = 'user',
    reportedUsername = '',
    reportedUserId  = null,
    roomId          = null,
    reporterId      = null,
    reporterName    = '',
  } = $props();

  const MOTIFS_USER = [
    { value: 'insultes',  label: 'Insultes / harcèlement' },
    { value: 'triche',    label: 'Triche / comportement déloyal' },
    { value: 'spam',      label: 'Spam / flood' },
    { value: 'autre',     label: 'Autre' },
  ];

  let motif   = $state('insultes');
  let message = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error   = $state('');

  async function submit() {
    if (!message.trim()) { error = 'Décris le problème.'; return; }
    error = '';
    loading = true;
    try {
      const body = type === 'user'
        ? {
            type: 'user',
            reporter_id: reporterId || null,
            reporter_name: reporterName || null,
            reported_user_id: reportedUserId || null,
            reported_username: reportedUsername || null,
            room_id: roomId || null,
            subject: motif,
            message: message.trim(),
          }
        : {
            type: 'bug',
            reporter_id: reporterId || null,
            reporter_name: reporterName || null,
            room_id: roomId || null,
            message: message.trim(),
          };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); error = d.error || 'Erreur.'; }
      else { success = true; message = ''; motif = 'insultes'; }
    } catch { error = 'Erreur réseau.'; }
    finally { loading = false; }
  }

  function close() {
    open    = false;
    success = false;
    error   = '';
    message = '';
    motif   = 'insultes';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="rm-backdrop" onclick={close}>
    <div class="rm-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
      <button class="rm-close" onclick={close} aria-label="Fermer">&times;</button>

      {#if success}
        <div class="rm-success">
          <div class="rm-success-icon">✓</div>
          <h2>Signalement envoyé</h2>
          <p>Merci, nous allons examiner ça.</p>
          <button class="rm-btn" onclick={close}>Fermer</button>
        </div>
      {:else}
        {#if type === 'user'}
          <h2 class="rm-title">Signaler <span class="rm-username">{reportedUsername}</span></h2>
          <p class="rm-subtitle">Le signalement est anonyme et sera examiné par un modérateur.</p>

          <div class="rm-field">
            <label for="rm-motif">Motif</label>
            <select id="rm-motif" bind:value={motif}>
              {#each MOTIFS_USER as m}
                <option value={m.value}>{m.label}</option>
              {/each}
            </select>
          </div>
        {:else}
          <h2 class="rm-title">🐛 Signaler un bug</h2>
          <p class="rm-subtitle">Décris ce qui s'est passé pour nous aider à corriger le problème.</p>
        {/if}

        <div class="rm-field">
          <label for="rm-message">Description <span class="rm-req">*</span></label>
          <textarea
            id="rm-message"
            bind:value={message}
            placeholder={type === 'user' ? 'Décris ce que ce joueur a fait…' : 'Que s\'est-il passé ? Depuis quand ? Sur quelle manche ?'}
            rows="4"
            maxlength="1000"
          ></textarea>
        </div>

        {#if error}<p class="rm-error">{error}</p>{/if}

        <button class="rm-btn" onclick={submit} disabled={loading}>
          {loading ? 'Envoi…' : 'Envoyer le signalement →'}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
.rm-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: rmFadeIn 0.18s ease;
}
@keyframes rmFadeIn { from { opacity: 0; } to { opacity: 1; } }

.rm-modal {
  background: var(--surface, #111827);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 18px;
  padding: 28px 24px 24px;
  width: 100%; max-width: 440px;
  position: relative;
  animation: rmSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes rmSlideIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.rm-close {
  position: absolute; top: 12px; right: 14px;
  background: none; border: none; color: var(--mid, #6b7280);
  font-size: 1.3rem; cursor: pointer; line-height: 1;
  transition: color 0.15s;
}
.rm-close:hover { color: var(--text, #fff); }

.rm-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.2rem; font-weight: 800; margin-bottom: 4px;
}
.rm-username { color: var(--accent, #6366f1); }
.rm-subtitle { font-size: 0.82rem; color: var(--mid, #6b7280); margin-bottom: 18px; }

.rm-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.rm-field label { font-size: 0.77rem; font-weight: 600; color: var(--mid, #6b7280); }
.rm-req { color: var(--accent, #6366f1); }

.rm-field select,
.rm-field textarea {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text, #fff);
  font-family: inherit; font-size: 0.88rem;
  outline: none; resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.rm-field select { resize: none; cursor: pointer; }
.rm-field select option { background: #1f2937; }
.rm-field select:focus,
.rm-field textarea:focus {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
}
.rm-field textarea { min-height: 90px; }

.rm-error { color: var(--danger, #f87171); font-size: 0.8rem; margin-bottom: 10px; }

.rm-btn {
  width: 100%;
  background: linear-gradient(135deg, var(--accent, #6366f1), var(--accent2, #a78bfa));
  color: #fff; border: none;
  padding: 12px; border-radius: 50px;
  font-weight: 700; font-size: 0.9rem; font-family: inherit;
  cursor: pointer; transition: opacity 0.15s, transform 0.1s;
}
.rm-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.rm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.rm-success {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 10px; padding: 12px 0;
}
.rm-success-icon {
  width: 50px; height: 50px; border-radius: 50%;
  background: rgba(74,222,128,0.15); border: 2px solid rgba(74,222,128,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; color: #4ade80;
}
.rm-success h2 { font-family: "Bricolage Grotesque", sans-serif; font-size: 1.2rem; font-weight: 800; }
.rm-success p { color: var(--mid, #6b7280); font-size: 0.85rem; }
.rm-success .rm-btn { width: auto; padding: 10px 24px; margin-top: 4px; }
</style>
