<script>
  import { onMount, getContext } from 'svelte';
  import { dicebear } from '$lib/utils.js';
  import ProfileStats from '$lib/components/ProfileStats.svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user      = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile     = $state(null);
  let stats       = $state(null);
  let loading     = $state(true);

  // Edit modal
  let editOpen      = $state(false);
  let editUsername  = $state('');
  let editAvatarUrl = $state('');
  let editError     = $state('');
  let editLoading   = $state(false);
  let avatarPreview = $state('');

  let toastMsg  = $state('');
  let toastType = $state('');
  let _toastTimer = null;

  function toast(msg, type = '') {
    clearTimeout(_toastTimer);
    toastMsg = msg; toastType = type;
    _toastTimer = setTimeout(() => { toastMsg = ''; }, 3200);
  }

  const name   = $derived(profile?.username || user?.email?.split('@')[0] || 'Joueur');
  const avatar = $derived(profile?.avatar_url || dicebear(name));

  function fmtSince(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  function xpForLevel(lvl) { return Math.round(50 * Math.pow(Math.max(0, lvl - 1), 2.5)); }
  function xpForNextLevel(lvl) { return Math.round(50 * Math.pow(lvl, 2.5)); }
  function xpPct(xp, level) {
    const min = xpForLevel(level), max = xpForNextLevel(level);
    return Math.min(100, Math.round(((xp - min) / (max - min)) * 100));
  }

  onMount(async () => {
    if (!sb) { loading = false; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) { loading = false; return; }
    await loadProfile(session.user);
  });

  async function loadProfile(u) {
    loading = true;
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', u.id).single();
      profile = data;
      await loadStats(u.id, data?.elo ?? 0);
    } finally {
      loading = false;
    }
  }

  async function loadStats(userId, elo) {
    try {
      const r = await fetch(`/api/stats/${userId}?elo=${elo}`);
      if (!r.ok) return;
      stats = await r.json();
    } catch {}
  }

  function openEdit() {
    editUsername  = profile?.username || user?.email?.split('@')[0] || '';
    editAvatarUrl = profile?.avatar_url || '';
    editError     = '';
    avatarPreview = editAvatarUrl || dicebear(editUsername || '?');
    editOpen      = true;
  }

  function updatePreview() {
    avatarPreview = editAvatarUrl.trim() || dicebear(editUsername || '?');
  }

  async function saveProfile() {
    editError = '';
    const username   = editUsername.trim();
    const avatar_url = editAvatarUrl.trim();
    if (!username) { editError = 'Le pseudo est requis.'; return; }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      editError = 'Pseudo invalide (3-20 caract\u00e8res, lettres/chiffres/_/-).'; return;
    }
    const old = profile?.username;
    if (username !== old) {
      const { data: exists } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
      if (exists) { editError = 'Ce pseudo est d\u00e9j\u00e0 pris.'; return; }
    }
    editLoading = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ username, avatar_url: avatar_url || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const updatedProfile = { ...profile, username, avatar_url: avatar_url || null };
      profile = updatedProfile;
      if (user?.id) {
        try {
          sessionStorage.setItem('zik_profile_' + user.id, JSON.stringify({ p: updatedProfile, ts: Date.now() }));
        } catch { /* sessionStorage indisponible */ }
        sessionStorage.setItem('zik_uname', username);
      }
      editOpen = false;
      toast('Profil mis \u00e0 jour\u00a0!', 'success');
    } catch (e) {
      editError = e.message;
    } finally {
      editLoading = false;
    }
  }
</script>

<svelte:head>
  <title>ZIK — Mon Profil | Blind Test Multijoueur</title>
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<div id="profile-page">
{#if loading || !authReady}
  <div class="pl-loading">Chargement...</div>
{:else if !user}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">&#x1F512;</div>
      <h2>Connexion requise</h2>
      <p>Connecte-toi pour acc&eacute;der &agrave; ton profil.</p>
      <button class="btn-accent" onclick={() => openAuthModal('login')} style="margin-top:16px">Se connecter</button>
    </div>
  </div>
{:else}
  <div class="profile-back-row">
    <button class="btn-back" onclick={() => history.back()}>Retour</button>
  </div>
  <div class="profile-hero">
    <div class="hero-bg">
      <div class="aurora-blob aurora-blob-1" style="opacity:0.5"></div>
      <div class="aurora-blob aurora-blob-2" style="opacity:0.3"></div>
    </div>
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
        <button class="profile-avatar-edit" onclick={openEdit} title="Changer l'avatar">&#x270E;</button>
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{name}</div>
        <div class="profile-hero-meta">
          <span class="profile-elo-badge">ELO {profile?.elo ?? '—'}</span>
          {#if stats?.topPercent}
            <span class="profile-top-badge">&#x1F3C6; Top {stats.topPercent}%</span>
          {/if}
        </div>
        {#if profile?.created_at}
          <div class="profile-since">Membre depuis {fmtSince(profile.created_at)}</div>
        {/if}
        {#if profile}
          <div class="profile-xp-row">
            <div class="profile-xp-level">Niveau {profile.level ?? 1}</div>
            <div class="profile-xp-bar">
              <div class="profile-xp-fill" style="width:{xpPct(profile.xp ?? 0, profile.level ?? 1)}%"></div>
            </div>
            <div class="profile-xp-caption">{profile.xp ?? 0} / {xpForNextLevel(profile.level ?? 1)} XP</div>
          </div>
        {/if}
      </div>
      <button class="btn-ghost sm" onclick={openEdit}>Modifier le profil</button>
    </div>
  </div>

  {#if profile}
    <ProfileStats {profile} {stats} />
  {/if}
{/if}
</div>

<!-- Edit modal -->
{#if editOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true"
  onclick={e => { if (e.target === e.currentTarget) editOpen = false; }}>
  <div class="modal">
    <button class="close-btn" onclick={() => editOpen = false}>&#x2715;</button>
    <h2>Modifier le profil</h2>
    <p class="mdesc">Personnalise ton pseudo et ton avatar.</p>

    <div class="field">
      <label>Pseudo <span style="color:var(--dim);font-weight:400;font-size:.78rem">(3-20 caract&egrave;res)</span></label>
      <input type="text" bind:value={editUsername} maxlength="20" autocomplete="off" oninput={updatePreview}>
    </div>

    <div class="field">
      <label>URL de l&apos;avatar <span style="color:var(--dim);font-weight:400;font-size:.78rem">&mdash; optionnel</span></label>
      <input type="url" bind:value={editAvatarUrl} placeholder="https://... (image carr&eacute;e recommand&eacute;e)" oninput={updatePreview}>
    </div>

    <div class="avatar-preview-wrap">
      <span style="font-size:.78rem;color:var(--dim)">Aper&ccedil;u :</span>
      <img src={avatarPreview} alt="" class="avatar-preview-img">
      <button class="btn-ghost sm" onclick={() => { editAvatarUrl = ''; updatePreview(); }}>G&eacute;n&eacute;rer auto</button>
    </div>

    {#if editError}<div class="alert-err">{editError}</div>{/if}
    <div class="modal-footer">
      <button class="btn-ghost" onclick={() => editOpen = false}>Annuler</button>
      <button class="btn-accent" onclick={saveProfile} disabled={editLoading}>{editLoading ? '...' : 'Enregistrer'}</button>
    </div>
  </div>
</div>
{/if}

{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}

<style>
/* -- Profile page -- */
.pl-loading {
  padding: 48px 16px;
  text-align: center;
  color: var(--dim);
  font-size: 0.88rem;
}
.profile-auth-wall {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding-top: var(--nav-h);
  text-align: center;
}
.profile-auth-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

#profile-page {
  padding-top: var(--nav-h);
  flex: 1;
}

/* -- Bouton retour -- */
.profile-back-row {
  padding: 14px clamp(16px, 5vw, 60px) 0;
}

/* -- Hero -- */
.profile-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, rgb(var(--accent-rgb) / 0.06) 0%, transparent 60%);
  border-bottom: 1px solid var(--border);
  padding: 36px clamp(16px, 5vw, 60px) 28px;
}
.profile-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.profile-avatar-wrap { position: relative; flex-shrink: 0; }
.profile-avatar-big {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgb(var(--accent-rgb) / 0.35);
  background: var(--surface);
}
.profile-avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: #000;
  border: 2px solid var(--bg);
  font-size: 0.72rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-hero-info { flex: 1; min-width: 0; }
.profile-username {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.profile-hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.profile-elo-badge {
  font-size: 0.82rem;
  color: var(--accent);
  font-weight: 600;
}
.profile-top-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
  border-radius: 99px;
  padding: 2px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}
.profile-since {
  font-size: 0.78rem;
  color: var(--dim);
  margin-top: 3px;
}
.profile-xp-row { margin-top: 12px; max-width: 300px; display: flex; flex-direction: column; gap: 5px; }
.profile-xp-level {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
}
.profile-xp-bar {
  background: rgb(var(--c-glass) / 0.08);
  border-radius: 99px;
  height: 6px;
}
.profile-xp-fill {
  background: linear-gradient(90deg, var(--accent), var(--accent2, var(--accent)));
  height: 100%;
  border-radius: 99px;
  transition: width 0.6s ease;
}
.profile-xp-caption {
  font-size: 0.68rem;
  color: var(--dim);
}
.profile-privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--dim);
  margin-top: 6px;
  background: rgb(var(--c-glass) / 0.06);
  border: 1px solid var(--border);
  border-radius: 99px;
  padding: 2px 10px;
}

/* -- Modal edition -- */
.avatar-preview-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 12px;
  flex-wrap: wrap;
}
.avatar-preview-img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  background: rgb(var(--c-glass) / 0.06);
}
.alert-err {
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.2);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-top: 6px;
}

/* -- Toast -- */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 50px;
  padding: 10px 20px;
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
}
.toast.success { border-color: var(--success); color: var(--success); }
.toast.error   { border-color: var(--danger);  color: var(--danger); }

/* -- Overlay + Modal -- */
.overlay {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  width: 100%; max-width: 440px;
}
.modal h2 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.1rem; font-weight: 800; margin-bottom: 16px;
}
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 0.78rem; font-weight: 600; color: var(--mid); }
.field input {
  background: rgb(var(--c-glass) / 0.04);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
}
.field input:focus {
  border-color: rgb(var(--accent-rgb) / 0.4);
  box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08);
}
.modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

@media (max-width: 700px) {
  .profile-hero-inner {
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 14px;
  }
  .profile-avatar-big { width: 68px; height: 68px; }
  .profile-hero-info { min-width: 0; overflow: hidden; }
  .profile-username {
    font-size: 1.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .profile-hero-inner > .btn-ghost { flex-shrink: 0; align-self: flex-start; margin-top: 4px; }
  .profile-xp-row { max-width: 100%; }
}
</style>
