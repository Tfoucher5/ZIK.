<script>
  import { onMount, getContext } from 'svelte';
  import { page } from '$app/stores';
  import { dicebear } from '$lib/utils.js';
  import ProfileStats from '$lib/components/ProfileStats.svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user      = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile    = $state(null);
  let stats      = $state(null);
  let loading    = $state(true);
  let notFound   = $state(false);

  const username     = $derived($page.params.username);
  const avatar       = $derived(profile?.avatar_url || dicebear(profile?.username || '?'));
  const isOwnProfile = $derived(user?.profile?.username === profile?.username);

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
    await loadPublicProfile();
  });

  async function loadPublicProfile() {
    loading = true;
    try {
      const token = (await sb.auth.getSession())?.data?.session?.access_token;
      const r = await fetch(`/api/profile/${username}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.status === 404 || !r.ok) { notFound = true; return; }
      profile = await r.json();
      if (profile && !profile.is_private) {
        await loadStats(profile.id, profile.elo ?? 0);
      }
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
</script>

<svelte:head>
  <title>ZIK &mdash; {profile?.username ?? username} | Profil joueur</title>
  <meta name="description" content="D&eacute;couvre le profil de {profile?.username ?? username} sur ZIK : ELO {profile?.elo ?? ''}, niveau {profile?.level ?? ''}, {profile?.games_played ?? ''} parties jou&eacute;es. Blind test musical multijoueur.">
  {#if !profile || profile.is_private}
    <meta name="robots" content="noindex, nofollow">
  {:else}
    <link rel="canonical" href="https://www.zik-music.fr/user/{username}">
    <meta property="og:title" content="{profile.username} sur ZIK &mdash; Blind Test Multijoueur">
    <meta property="og:description" content="ELO {profile.elo ?? '?'} &middot; Niveau {profile.level ?? '?'} &middot; {profile.games_played ?? '0'} parties jou&eacute;es. D&eacute;couvre son profil sur ZIK.">
    <meta property="og:url" content="https://www.zik-music.fr/user/{username}">
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
  <div class="profile-hero">
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{profile.username}</div>
        <div class="profile-hero-meta">
          <span class="profile-elo-badge">ELO {profile.elo ?? '—'}</span>
          {#if stats?.topPercent}
            <span class="profile-top-badge">&#x1F3C6; Top {stats.topPercent}%</span>
          {/if}
          {#if profile.is_private}
            <span class="profile-privacy-badge">&#x1F510; Profil priv&eacute;</span>
          {/if}
        </div>
        {#if profile.created_at}
          <div class="profile-since">Membre depuis {fmtSince(profile.created_at)}</div>
        {/if}
        <div class="profile-xp-row">
          <div class="profile-xp-label">
            <span>Niveau {profile.level ?? 1}</span>
            <span>{profile.xp ?? 0} / {xpForNextLevel(profile.level ?? 1)} XP</span>
          </div>
          <div class="profile-xp-bar">
            <div class="profile-xp-fill" style="width:{xpPct(profile.xp ?? 0, profile.level ?? 1)}%"></div>
          </div>
        </div>
      </div>
      {#if isOwnProfile}
        <a href="/profile" class="btn-ghost sm">Modifier mon profil</a>
      {/if}
    </div>
  </div>

  <ProfileStats {profile} {stats} />
{/if}
</div>
