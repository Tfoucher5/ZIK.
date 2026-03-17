<script>
  import { onMount, getContext } from 'svelte';
  import { page } from '$app/stores';
  import { dicebear } from '$lib/utils.js';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile    = $state(null);
  let bestScores = $state([]);
  let loading    = $state(true);
  let notFound   = $state(false);

  const username = $derived($page.params.username);

  const avatar = $derived(profile?.avatar_url || dicebear(profile?.username || '?'));
  const isOwnProfile = $derived(user?.profile?.username === profile?.username);

  onMount(async () => {
    if (!sb) { loading = false; return; }
    // Wait for auth to be ready
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) { loading = false; return; }
    await loadPublicProfile();
  });

  async function loadPublicProfile() {
    loading = true;
    try {
      const token = (await sb.auth.getSession())?.data?.session?.access_token;
      const r = await fetch(`/api/profile/${username}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (r.status === 404) { notFound = true; return; }
      if (!r.ok) { notFound = true; return; }
      profile = await r.json();
      if (profile && !profile.is_private) {
        await loadBestScores(profile.id);
      }
    } finally {
      loading = false;
    }
  }

  async function loadBestScores(userId) {
    try {
      const r = await fetch(`/api/stats/${userId}`);
      if (!r.ok) return;
      const { bestByRoom, roomInfo } = await r.json();
      const entries = Object.entries(bestByRoom || {}).sort((a, b) => b[1] - a[1]);
      bestScores = entries.map(([roomId, score]) => ({ room: roomInfo[roomId], score })).filter(e => e.room);
    } catch {}
  }
</script>

<svelte:head>
  <title>ZIK — {profile?.username ?? username} | Profil joueur</title>
  <meta name="description" content="Découvre le profil de {profile?.username ?? username} sur ZIK : ELO {profile?.elo ?? ''}, niveau {profile?.level ?? ''}, {profile?.games_played ?? ''} parties jouées. Blind test musical multijoueur.">
  {#if !profile || profile.is_private}
    <meta name="robots" content="noindex, nofollow">
  {:else}
    <link rel="canonical" href="https://zik.app/user/{username}">
    <meta property="og:title" content="{profile.username} sur ZIK — Blind Test Multijoueur">
    <meta property="og:description" content="ELO {profile.elo ?? '?'} · Niveau {profile.level ?? '?'} · {profile.games_played ?? '0'} parties jouées. Découvre son profil sur ZIK.">
    <meta property="og:url" content="https://zik.app/user/{username}">
    <meta property="og:type" content="profile">
  {/if}
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
      <p>Tu dois &ecirc;tre connect&eacute; pour voir le profil d&apos;un joueur.</p>
      <button class="btn-accent" onclick={() => openAuthModal('login')} style="margin-top:16px">Se connecter</button>
    </div>
  </div>
{:else if notFound}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">&#x1F575;</div>
      <h2>Profil introuvable</h2>
      <p>Le joueur <strong>{username}</strong> n&apos;existe pas.</p>
      <a href="/" class="btn-ghost" style="margin-top:16px">&larr; Retour &agrave; l&apos;accueil</a>
    </div>
  </div>
{:else if profile?.is_private && !isOwnProfile}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">&#x1F510;</div>
      <h2>Profil priv&eacute;</h2>
      <p><strong>{profile.username}</strong> a rendu son profil priv&eacute;.</p>
      <a href="/" class="btn-ghost" style="margin-top:16px">&larr; Retour &agrave; l&apos;accueil</a>
    </div>
  </div>
{:else if profile}
  <!-- Hero -->
  <div class="profile-hero">
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{profile.username}</div>
        <div class="profile-level">Niveau {profile.level || 1} &mdash; {profile.xp || 0} XP</div>
        {#if profile.is_private}
          <div class="profile-privacy-badge">&#x1F510; Profil priv&eacute;</div>
        {/if}
      </div>
      {#if isOwnProfile}
        <a href="/profile" class="btn-ghost sm">Modifier mon profil</a>
      {/if}
    </div>
  </div>

  <!-- Stats -->
  <div class="profile-section">
    <h2>Statistiques</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">{profile.elo ?? '&mdash;'}</div><div class="stat-label">ELO</div></div>
      <div class="stat-card"><div class="stat-val">{profile.level ?? '&mdash;'}</div><div class="stat-label">Niveau</div></div>
      <div class="stat-card"><div class="stat-val">{profile.games_played ?? '&mdash;'}</div><div class="stat-label">Parties</div></div>
      <div class="stat-card"><div class="stat-val">{profile.total_score ?? '&mdash;'}</div><div class="stat-label">Score total</div></div>
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
