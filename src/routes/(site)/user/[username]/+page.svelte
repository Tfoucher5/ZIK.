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

  async function fetchWithRetry(url, opts = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch(url, opts);
        if (r.ok) return r;
        if (r.status === 404) return r; // pas la peine de retry un 404
        if (i < retries - 1) await new Promise(res => setTimeout(res, 600 * (i + 1)));
      } catch {
        if (i < retries - 1) await new Promise(res => setTimeout(res, 600 * (i + 1)));
      }
    }
    return null;
  }

  async function loadPublicProfile() {
    loading = true;
    try {
      const token = (await sb.auth.getSession())?.data?.session?.access_token;
      const r = await fetchWithRetry(`/api/profile/${username}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r || r.status === 404 || !r.ok) { notFound = true; return; }
      profile = await r.json();
      if (profile && !profile.is_private) {
        await loadStats(profile.id, profile.elo ?? 0);
      }
    } finally {
      loading = false;
    }
  }

  async function loadStats(userId, elo) {
    const r = await fetchWithRetry(`/api/stats/${userId}?elo=${elo}`);
    if (r?.ok) stats = await r.json();
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
          <div class="profile-xp-level">Niveau {profile.level ?? 1}</div>
          <div class="profile-xp-bar">
            <div class="profile-xp-fill" style="width:{xpPct(profile.xp ?? 0, profile.level ?? 1)}%"></div>
          </div>
          <div class="profile-xp-caption">{profile.xp ?? 0} / {xpForNextLevel(profile.level ?? 1)} XP</div>
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

<style>
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
.profile-since {
  font-size: 0.78rem;
  color: var(--dim);
  margin-top: 3px;
}
.profile-back-row { padding: 14px clamp(16px, 5vw, 60px) 0; }
.profile-xp-row { margin-top: 12px; max-width: 300px; display: flex; flex-direction: column; gap: 5px; }
.profile-xp-level { font-size: 0.75rem; font-weight: 700; color: var(--text); }
.profile-xp-caption { font-size: 0.68rem; color: var(--dim); }
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
@media (max-width: 700px) {
  .profile-username { font-size: 1.5rem; }
}
</style>
