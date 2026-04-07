<script>
  import { onMount, getContext } from 'svelte';
  import { dicebear } from '$lib/utils.js';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile     = $state(null);
  let stats       = $state(null);
  let bestScores  = $state([]);
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
      await loadStats(u.id);
    } finally {
      loading = false;
    }
  }

  async function loadStats(userId) {
    try {
      const r = await fetch(`/api/stats/${userId}`);
      if (!r.ok) return;
      const { bestByRoom, roomInfo } = await r.json();
      const entries = Object.entries(bestByRoom || {}).sort((a, b) => b[1] - a[1]);
      bestScores = entries.map(([roomId, score]) => ({ room: roomInfo[roomId], score })).filter(e => e.room);
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
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) { editError = 'Pseudo invalide (3-20 caract\u00e8res, lettres/chiffres/_/-).'; return; }

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
      // Mettre à jour le cache sessionStorage pour que le layout reflète les changements immédiatement
      if (user?.id) {
        try {
          sessionStorage.setItem('zik_profile_' + user.id, JSON.stringify({ p: updatedProfile, ts: Date.now() }));
        } catch { /* sessionStorage indisponible */ }
        sessionStorage.setItem('zik_uname', username);
      }
      editOpen = false;
      toast('Profil mis \u00e0 jour !', 'success');
    } catch (e) {
      editError = e.message;
    } finally {
      editLoading = false;
    }
  }
</script>

<svelte:head>
  <title>ZIK — Mon profil</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/profile.css">
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
  <!-- Hero -->
  <div class="profile-hero">
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
        <button class="profile-avatar-edit" onclick={openEdit} title="Changer l&apos;avatar">&#x270E;</button>
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{name}</div>
        <div class="profile-level">Niveau {profile?.level || 1} &mdash; {profile?.xp || 0} XP</div>
      </div>
      <button class="btn-ghost sm" onclick={openEdit}>Modifier le profil</button>
    </div>
  </div>

  <!-- Stats -->
  <div class="profile-section">
    <h2>Statistiques</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">{profile?.elo ?? '&mdash;'}</div><div class="stat-label">ELO</div></div>
      <div class="stat-card"><div class="stat-val">{profile?.level ?? '&mdash;'}</div><div class="stat-label">Niveau</div></div>
      <div class="stat-card"><div class="stat-val">{profile?.games_played ?? '&mdash;'}</div><div class="stat-label">Parties</div></div>
      <div class="stat-card"><div class="stat-val">{profile?.total_score ?? '&mdash;'}</div><div class="stat-label">Score total</div></div>
    </div>
  </div>

  <!-- Best scores -->
  <div class="profile-section">
    <h2>Meilleurs scores par room</h2>
    <div class="best-scores-list">
      {#if bestScores.length}
        {#each bestScores as { room, score }}
          <div class="best-score-row">
            <span class="best-score-emoji">{room.emoji || '&#x1F3B5;'}</span>
            <div class="best-score-info"><div class="best-score-room">{room.name}</div></div>
            <span class="best-score-pts">{score} pts</span>
          </div>
        {/each}
      {:else}
        <p class="profile-empty">Aucune partie jou&eacute;e sur les rooms officielles.</p>
      {/if}
    </div>
  </div>
{/if}

</div>

<!-- Edit profile modal -->
{#if editOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) editOpen = false; }}>
  <div class="modal">
    <button class="close-btn" onclick={() => editOpen = false}>&#x2715;</button>
    <h2>Modifier le profil</h2>
    <p class="mdesc">Personnalise ton pseudo et ton avatar.</p>

    <div class="field">
      <label for="pseudo">Pseudo <span style="color:var(--dim);font-weight:400;font-size:.78rem">(3-20 caract&egrave;res)</span></label>
      <input type="text" bind:value={editUsername} maxlength="20" autocomplete="off" oninput={updatePreview}>
    </div>

    <div class="field">
      <label for="avatar">URL de l&apos;avatar <span style="color:var(--dim);font-weight:400;font-size:.78rem">&mdash; optionnel</span></label>
      <input type="url" bind:value={editAvatarUrl} placeholder="https://... (image carrée recommandée)" oninput={updatePreview}>
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

<!-- Toast -->
{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}
