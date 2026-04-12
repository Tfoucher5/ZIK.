<script>
  import { onMount, onDestroy, getContext } from 'svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let animOn       = $state(true);
  let hideAnnouncements = $state(false);
  let volVal     = $state(50);
  let activeTheme = $state('dark');
  let isPrivate  = $state(false);
  let privLoading = $state(false);

  // ── Account deletion state ───────────────────────────────────────────────
  let deleteModalOpen   = $state(false);
  let deleteConfirmText = $state('');
  let deleteLoading     = $state(false);
  let deleteError       = $state('');

  let toastMsg  = $state('');
  let toastType = $state('');
  let _toastTimer = null;

  function toast(msg, type = '') {
    clearTimeout(_toastTimer);
    toastMsg = msg; toastType = type;
    _toastTimer = setTimeout(() => { toastMsg = ''; }, 3200);
  }

  function openDeleteModal() {
    deleteConfirmText = '';
    deleteError = '';
    deleteModalOpen = true;
    // Focus the input after the modal renders
    setTimeout(() => document.getElementById('delete-confirm-input')?.focus(), 80);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    deleteModalOpen = false;
    deleteConfirmText = '';
    deleteError = '';
  }

  async function confirmDeleteAccount() {
    if (!sb || !user) return;
    const expectedUsername = user.profile?.username || user.email?.split('@')[0] || '';
    if (deleteConfirmText.trim() !== expectedUsername) {
      deleteError = 'Le pseudo ne correspond pas.';
      return;
    }
    deleteLoading = true;
    deleteError = '';
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch('/api/profile/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const d = await r.json();
      if (!r.ok && !d.partial) throw new Error(d.error || `HTTP ${r.status}`);
      // Sign out locally regardless
      await sb.auth.signOut();
      window.location.href = '/?deleted=1';
    } catch (e) {
      deleteError = e.message;
      deleteLoading = false;
    }
  }

  onDestroy(() => clearTimeout(_toastTimer));

  const THEMES = [
    { id: 'dark',   label: 'Sombre',  bg: '#070b10', accent: '#3ecfff' },
    { id: 'light',  label: 'Clair',   bg: '#f4f6fb', accent: '#0ea5e9' },
    { id: 'violet', label: 'Violet',  bg: '#0c0814', accent: '#a78bfa' },
  ];

  function setTheme(t) {
    activeTheme = t;
    localStorage.setItem('zik_theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  onMount(() => {
    animOn = localStorage.getItem('zik_animations') !== 'off';
    hideAnnouncements = localStorage.getItem('zik_hide_announcements') === 'true';
    volVal = parseInt(localStorage.getItem('zik_vol') ?? '50');
    activeTheme = localStorage.getItem('zik_theme') || 'dark';
    const el = document.getElementById('pref-volume');
    if (el) el.style.setProperty('--vol', volVal + '%');
  });

  // Load privacy setting from profile when user is available
  $effect(() => {
    if (user?.profile) {
      isPrivate = user.profile.is_private ?? false;
    }
  });

  function toggleAnim(e) {
    animOn = e.target.checked;
    localStorage.setItem('zik_animations', animOn ? 'on' : 'off');
    document.documentElement.classList.toggle('no-animations', !animOn);
  }

  function toggleHideAnnouncements(e) {
    hideAnnouncements = e.target.checked;
    localStorage.setItem('zik_hide_announcements', hideAnnouncements ? 'true' : 'false');
  }

  function changeVol(e) {
    volVal = parseInt(e.target.value);
    e.target.style.setProperty('--vol', volVal + '%');
    localStorage.setItem('zik_vol', volVal);
  }

  async function togglePrivacy(e) {
    const newVal = e.target.checked;
    if (!sb || !user) return;
    privLoading = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_private: newVal }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      isPrivate = newVal;
      // Update cached profile
      if (user.profile) user.profile.is_private = newVal;
      toast(newVal ? 'Profil mis en priv\u00e9' : 'Profil mis en public', 'success');
    } catch (e) {
      toast('Erreur : ' + e.message, 'error');
    } finally {
      privLoading = false;
    }
  }
</script>

<svelte:head>
  <title>ZIK — Paramètres</title>
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<main class="settings-page">
  <div class="settings-container">
    <button class="settings-back" onclick={() => history.back()}>&larr; Retour</button>
    <h1 class="settings-title">Param&egrave;tres</h1>
    <p class="settings-sub">Personnalise ton exp&eacute;rience ZIK.</p>

    <section class="settings-section">
      <h2 class="settings-section-title">Visuel</h2>
      <div class="settings-row settings-row-theme">
        <div class="settings-row-info">
          <div class="settings-row-label">Th&egrave;me</div>
          <div class="settings-row-desc">Choisis l&apos;apparence de l&apos;interface.</div>
        </div>
        <div class="theme-picker">
          {#each THEMES as theme}
            <button
              class="theme-swatch {activeTheme === theme.id ? 'active' : ''}"
              style="--swatch-bg:{theme.bg};--swatch-accent:{theme.accent}"
              onclick={() => setTheme(theme.id)}
              aria-label="Th&egrave;me {theme.label}"
              title={theme.label}
            >
              <span class="swatch-preview">
                <span class="swatch-bar"></span>
                <span class="swatch-dot"></span>
              </span>
              <span class="swatch-label">{theme.label}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Animations</div>
          <div class="settings-row-desc">Active ou d&eacute;sactive les animations de l&apos;interface (cartes, scores, transitions). D&eacute;sactivez si vous ressentez des ralentissements.</div>
        </div>
        <label class="toggle-switch" aria-label="Activer les animations">
          <input type="checkbox" checked={animOn} onchange={toggleAnim}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Masquer les annonces</div>
          <div class="settings-row-desc">Ne plus afficher la fen&ecirc;tre d&apos;informations au chargement du site.</div>
        </div>
        <label class="toggle-switch" aria-label="Masquer les annonces">
          <input type="checkbox" checked={hideAnnouncements} onchange={toggleHideAnnouncements}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section-title">Jeu</h2>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Volume par d&eacute;faut</div>
          <div class="settings-row-desc">Volume de la musique au d&eacute;marrage d&apos;une partie.</div>
        </div>
        <div class="settings-vol-wrap">
          <input id="pref-volume" type="range" min="0" max="100" step="5" value={volVal} oninput={changeVol}>
          <span class="settings-vol-val">{volVal}%</span>
        </div>
      </div>
    </section>

    {#if authReady && user}
    <section class="settings-section">
      <h2 class="settings-section-title">Confidentialit&eacute;</h2>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Profil priv&eacute; &#x1F510;</div>
          <div class="settings-row-desc">
            {#if isPrivate}
              Ton profil est <strong>priv&eacute;</strong> : seul toi peux voir tes stats et meilleurs scores.
            {:else}
              Ton profil est <strong>public</strong> : n&apos;importe quel joueur connect&eacute; peut voir tes stats.
            {/if}
          </div>
        </div>
        <label class="toggle-switch" aria-label="Profil priv&eacute;">
          <input type="checkbox" checked={isPrivate} onchange={togglePrivacy} disabled={privLoading}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    </section>

    <section class="settings-section settings-section-danger">
      <h2 class="settings-section-title danger-title">&#x26A0;&#xFE0F; Zone dangereuse</h2>
      <div class="settings-row settings-row-danger">
        <div class="settings-row-info">
          <div class="settings-row-label">Supprimer mon compte</div>
          <div class="settings-row-desc">
            Supprime d&eacute;finitivement ton compte, ton profil, tes playlists et tous tes scores. <strong>Cette action est irr&eacute;versible.</strong>
          </div>
        </div>
        <button class="btn-danger" onclick={openDeleteModal}>
          Supprimer
        </button>
      </div>
    </section>
    {/if}

  </div>
</main>

<!-- ── Delete account confirmation modal ──────────────────────────────────── -->
{#if deleteModalOpen}
  <div class="delete-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
    <div class="delete-modal">
      <h2 class="delete-modal-title" id="delete-modal-title">&#x1F6A8; Supprimer mon compte</h2>
      <p class="delete-modal-desc">
        Cette action est <strong>irr&eacute;versible</strong>. Ton profil, tes playlists, tes scores et toutes tes donn&eacute;es seront supprim&eacute;s d&eacute;finitivement.
      </p>
      <div class="delete-modal-confirm-label">
        Pour confirmer, tape ton pseudo&nbsp;:
        <strong class="delete-modal-username">{user?.profile?.username || user?.email?.split('@')[0] || '…'}</strong>
      </div>
      <input
        id="delete-confirm-input"
        class="delete-modal-input"
        type="text"
        bind:value={deleteConfirmText}
        placeholder="Ton pseudo ici"
        autocomplete="off"
        spellcheck="false"
        disabled={deleteLoading}
        onkeydown={e => { if (e.key === 'Enter') confirmDeleteAccount(); if (e.key === 'Escape') closeDeleteModal(); }}
      >
      {#if deleteError}
        <p class="delete-modal-error">{deleteError}</p>
      {/if}
      <div class="delete-modal-actions">
        <button class="btn-delete-cancel" onclick={closeDeleteModal} disabled={deleteLoading}>
          Annuler
        </button>
        <button
          class="btn-delete-confirm"
          onclick={confirmDeleteAccount}
          disabled={deleteLoading || deleteConfirmText.trim() !== (user?.profile?.username || user?.email?.split('@')[0] || '')}
        >
          {#if deleteLoading}
            Suppression…
          {:else}
            Supprimer d&eacute;finitivement
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}

<style>
.settings-page {
  max-width: 640px;
  margin: 0 auto;
  padding: calc(var(--nav-h) + 32px) 24px 80px;
}
.settings-back {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--mid);
  font-weight: 500;
  margin-bottom: 20px;
  transition: color 0.15s;
}
.settings-back:hover { color: var(--text); }
.settings-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
.settings-sub {
  font-size: 0.9rem;
  color: var(--mid);
  margin-bottom: 40px;
}

/* -- Sections -- */
.settings-section {
  margin-bottom: 24px;
  background: rgb(var(--c-glass) / 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
}
.settings-section::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.08), transparent);
  pointer-events: none;
}
.settings-section-title {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--dim);
  padding: 14px 20px 10px;
  border-bottom: 1px solid var(--border);
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.settings-row:last-child { border-bottom: none; }
.settings-row-info { flex: 1; min-width: 0; }
.settings-row-label { font-size: 0.88rem; font-weight: 500; margin-bottom: 2px; }
.settings-row-desc { font-size: 0.75rem; color: var(--dim); line-height: 1.45; }

/* -- Theme picker -- */
.settings-row-theme { align-items: flex-start; flex-wrap: wrap; gap: 16px; }
.theme-picker { display: flex; gap: 10px; flex-shrink: 0; }
.theme-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 8px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
  font-family: inherit;
}
.theme-swatch:hover { border-color: var(--mid); transform: translateY(-2px); }
.theme-swatch.active { border-color: var(--accent); }
.swatch-preview {
  width: 52px; height: 36px; border-radius: 7px;
  background: var(--swatch-bg);
  position: relative; overflow: hidden;
  display: flex; align-items: flex-end; padding: 5px;
}
.swatch-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 8px;
  background: var(--swatch-accent); opacity: 0.55;
}
.swatch-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--swatch-accent);
  box-shadow: 0 0 6px var(--swatch-accent);
  margin-left: auto;
}
.swatch-label { font-size: 0.72rem; font-weight: 600; color: var(--mid); letter-spacing: 0.3px; }
.theme-swatch.active .swatch-label { color: var(--accent); }

/* -- Toggle switch -- */
.toggle-switch { position: relative; display: inline-block; flex-shrink: 0; cursor: pointer; }
.toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: block; width: 44px; height: 24px;
  background: rgb(var(--c-glass) / 0.12);
  border-radius: 99px; transition: background 0.2s; position: relative;
}
.toggle-switch input:checked + .toggle-track { background: var(--accent); }
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.toggle-switch input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); }

/* -- Volume slider -- */
.settings-vol-wrap { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
#pref-volume {
  -webkit-appearance: none; appearance: none;
  width: 140px; height: 4px; cursor: pointer; border-radius: 99px;
  background: linear-gradient(to right, var(--accent) var(--vol, 50%), rgb(var(--c-glass) / 0.12) var(--vol, 50%));
  outline: none; border: none;
}
#pref-volume::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent); cursor: pointer;
  box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.5);
}
#pref-volume::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  border: none; background: var(--accent); cursor: pointer;
}
.settings-vol-val { font-size: 0.82rem; font-weight: 600; color: var(--accent); min-width: 36px; text-align: right; }

/* -- Danger zone -- */
.settings-section-danger { border-color: rgba(239,68,68,0.35); }
.settings-section-danger .danger-title { color: var(--danger); border-bottom-color: rgba(239,68,68,0.2); }
.settings-row-danger { background: rgba(239,68,68,0.04); }
.btn-danger {
  flex-shrink: 0;
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.4);
  color: var(--danger);
  font-size: 0.82rem; font-weight: 600;
  padding: 7px 16px; border-radius: 8px;
  cursor: pointer; font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}
.btn-danger:hover { background: rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.65); }

/* -- Delete modal -- */
.delete-overlay {
  position: fixed; inset: 0;
  background: rgba(4,6,14,0.82);
  backdrop-filter: blur(8px);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.delete-modal {
  background: var(--bg2);
  border: 1px solid rgba(239,68,68,0.35);
  border-radius: var(--radius);
  padding: 32px; max-width: 420px; width: 100%;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}
.delete-modal-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.25rem; font-weight: 800;
  color: var(--danger); margin-bottom: 12px;
}
.delete-modal-desc { font-size: 0.88rem; color: var(--mid); line-height: 1.55; margin-bottom: 20px; }
.delete-modal-confirm-label { font-size: 0.82rem; color: var(--dim); margin-bottom: 8px; }
.delete-modal-username { color: var(--text); }
.delete-modal-input {
  width: 100%;
  background: rgb(var(--c-glass) / 0.05);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text); font-size: 0.9rem; font-family: inherit;
  padding: 10px 14px; outline: none;
  transition: border-color 0.2s; box-sizing: border-box; margin-bottom: 6px;
}
.delete-modal-input:focus { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
.delete-modal-error { font-size: 0.78rem; color: var(--danger); margin: 4px 0 12px; }
.delete-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
.btn-delete-cancel {
  flex: 1;
  background: rgb(var(--c-glass) / 0.06);
  border: 1px solid var(--border); color: var(--mid);
  font-size: 0.88rem; font-family: inherit; font-weight: 500;
  padding: 10px 16px; border-radius: 10px; cursor: pointer;
  transition: background 0.15s;
}
.btn-delete-cancel:hover:not(:disabled) { background: rgb(var(--c-glass) / 0.1); }
.btn-delete-cancel:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-delete-confirm {
  flex: 2;
  background: linear-gradient(135deg, #b91c1c, #ef4444);
  border: none; color: #fff;
  font-size: 0.88rem; font-family: inherit; font-weight: 700;
  padding: 10px 16px; border-radius: 10px; cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
}
.btn-delete-confirm:hover:not(:disabled) { filter: brightness(1.12); }
.btn-delete-confirm:disabled { opacity: 0.35; cursor: not-allowed; filter: none; }

/* -- Toast -- */
.toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  z-index: 999; background: var(--bg2); border: 1px solid var(--border);
  border-radius: 50px; padding: 10px 20px; font-size: 0.85rem;
  white-space: nowrap; pointer-events: none;
}
.toast.success { border-color: var(--success); color: var(--success); }
.toast.error   { border-color: var(--danger);  color: var(--danger); }

/* -- Responsive -- */
@media (max-width: 640px) {
  .settings-row { flex-wrap: wrap; gap: 12px; }
  .settings-row-theme { flex-direction: column; align-items: stretch; }
  .theme-picker { width: 100%; justify-content: space-between; }
  .theme-swatch { flex: 1; min-width: 0; }
  .swatch-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
</style>
