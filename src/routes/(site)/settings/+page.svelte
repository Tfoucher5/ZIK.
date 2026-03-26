<script>
  import { onMount, onDestroy, getContext } from 'svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let animOn     = $state(true);
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
  <link rel="stylesheet" href="/css/settings.css">
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
