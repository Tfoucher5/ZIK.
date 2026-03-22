<script>
  import { onMount } from 'svelte';

  let { data } = $props();
  const { room } = data;

  let loggedUser   = $state(null);
  let guestName    = $state('');
  let guestError   = $state('');
  let joining      = $state(false);

  const desc = room.description || `Rejoins la room ${room.name} sur ZIK pour un blind test musical multijoueur en ligne.`;
  const pageTitle = `${room.emoji} ${room.name} — Blind Test ZIK`;
  const canonicalUrl = `https://www.zik-music.fr/room/${room.code}`;

  onMount(() => {
    const uid   = sessionStorage.getItem('zik_uid');
    const uname = sessionStorage.getItem('zik_uname');
    if (uid && uname) loggedUser = { uid, uname };
  });

  function joinAsLogged() {
    if (!loggedUser) return;
    joining = true;
    const p = new URLSearchParams({ roomId: room.code, username: loggedUser.uname, userId: loggedUser.uid, isGuest: '0' });
    window.location.href = `/game?${p}`;
  }

  function joinAsGuest() {
    const name = guestName.trim();
    if (!name) { guestError = 'Entre un pseudo pour jouer.'; return; }
    if (name.length < 2 || name.length > 20) { guestError = 'Le pseudo doit faire entre 2 et 20 caractères.'; return; }
    guestError = '';
    joining = true;
    localStorage.setItem('zik_guest', name);
    const uid = 'guest_' + Date.now();
    sessionStorage.setItem('zik_uid', uid);
    sessionStorage.setItem('zik_uname', name);
    const p = new URLSearchParams({ roomId: room.code, username: name, userId: uid, isGuest: '1' });
    window.location.href = `/game?${p}`;
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="{desc} Gratuit, sans installation, directement dans le navigateur.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href={canonicalUrl}>

  <meta property="og:title" content={pageTitle}>
  <meta property="og:description" content="{desc} Rejoins maintenant, c'est gratuit !">
  <meta property="og:url" content={canonicalUrl}>
  <meta property="og:type" content="website">

  <script type="application/ld+json">
  {@html JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Game",
    "name": `${room.name} — Blind Test ZIK`,
    "description": desc,
    "url": canonicalUrl,
    "genre": ["Music", "Quiz", "Trivia"],
    "isAccessibleForFree": true,
    "inLanguage": "fr-FR",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
  })}
  </script>

  <link rel="stylesheet" href="/css/home.css">
</svelte:head>

<main class="room-landing">

  <!-- Hero -->
  <div class="room-hero">
    <div class="room-hero-bg">
      <div class="orb o1"></div>
      <div class="orb o2"></div>
    </div>
    <div class="room-hero-content">
      {#if room.is_official}
        <span class="room-badge-official">⭐ Room officielle</span>
      {/if}
      <div class="room-emoji">{room.emoji}</div>
      <h1 class="room-title">{room.name}</h1>
      {#if room.description}
        <p class="room-desc">{room.description}</p>
      {/if}
      <div class="room-meta">
        <span class="room-meta-chip">🎵 Blind Test</span>
        <span class="room-meta-chip">🌐 Multijoueur</span>
        <span class="room-meta-chip">⚡ Gratuit</span>
      </div>
    </div>
  </div>

  <!-- Join card -->
  <div class="room-join-wrap">
    <div class="room-join-card">
      <h2 class="room-join-title">Rejoindre la room</h2>

      {#if loggedUser}
        <p class="room-join-sub">Connecté en tant que <strong>{loggedUser.uname}</strong></p>
        <button class="btn-room-join" onclick={joinAsLogged} disabled={joining}>
          {joining ? 'Connexion…' : '▶ Jouer maintenant'}
        </button>
        <p class="room-join-or">ou jouer en tant qu'invité ↓</p>
      {/if}

      <div class="room-guest-form">
        {#if !loggedUser}
          <p class="room-join-sub">Aucune inscription requise — entre juste un pseudo !</p>
        {/if}
        <input
          type="text"
          class="room-guest-input"
          bind:value={guestName}
          placeholder="Ton pseudo…"
          maxlength="20"
          disabled={joining}
          onkeydown={e => { if (e.key === 'Enter') joinAsGuest(); }}
        >
        {#if guestError}
          <p class="room-guest-error">{guestError}</p>
        {/if}
        <button class="btn-room-guest" onclick={joinAsGuest} disabled={joining || !guestName.trim()}>
          {joining ? 'Connexion…' : '→ Jouer en invité'}
        </button>
      </div>

      <p class="room-back-link">
        <a href="/rooms">← Voir toutes les rooms</a>
      </p>
    </div>
  </div>

  <!-- SEO content block (visible and useful to users too) -->
  <section class="room-seo-block">
    <h2>Comment jouer au blind test sur ZIK ?</h2>
    <ol>
      <li>Entre ton pseudo ci-dessus et clique sur <strong>Jouer maintenant</strong></li>
      <li>Écoute l'extrait musical qui se lance — identifie l'artiste et le titre</li>
      <li>Tape ta réponse dans le champ prévu et valide — plus tu es rapide, plus tu marques de points</li>
      <li>Grimpe dans le classement et défie les autres joueurs en ligne !</li>
    </ol>
    <p>Le blind test est <strong>gratuit</strong>, sans installation, directement dans le navigateur. <a href="/docs">En savoir plus sur le fonctionnement →</a></p>
  </section>

</main>

<style>
  .room-landing {
    min-height: 100vh;
    padding-top: var(--nav-h, 64px);
  }

  /* ── Hero ── */
  .room-hero {
    position: relative;
    overflow: hidden;
    padding: 60px clamp(16px, 5vw, 80px) 48px;
    text-align: center;
  }
  .room-hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .room-badge-official {
    display: inline-block;
    background: rgba(250, 204, 21, 0.12);
    border: 1px solid rgba(250, 204, 21, 0.3);
    color: #fbbf24;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 50px;
    letter-spacing: 0.3px;
    margin-bottom: 20px;
  }
  .room-emoji {
    font-size: 3.5rem;
    line-height: 1;
    margin-bottom: 16px;
  }
  .room-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 12px;
  }
  .room-desc {
    font-size: 1rem;
    color: var(--mid, #94a3b8);
    max-width: 500px;
    margin: 0 auto 20px;
    line-height: 1.6;
  }
  .room-meta {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .room-meta-chip {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50px;
    padding: 4px 12px;
    font-size: 0.78rem;
    color: var(--mid, #94a3b8);
  }

  /* ── Join card ── */
  .room-join-wrap {
    display: flex;
    justify-content: center;
    padding: 0 clamp(16px, 5vw, 80px) 48px;
  }
  .room-join-card {
    background: var(--surface, rgba(255,255,255,0.04));
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 420px;
    text-align: center;
  }
  .room-join-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .room-join-sub {
    font-size: 0.85rem;
    color: var(--mid, #94a3b8);
    margin-bottom: 14px;
  }
  .room-join-or {
    font-size: 0.78rem;
    color: var(--dim, #64748b);
    margin: 12px 0 16px;
  }
  .btn-room-join {
    width: 100%;
    background: linear-gradient(135deg, var(--accent, #3ecfff), var(--accent2, #a78bfa));
    border: none;
    color: #0a0d1a;
    font-size: 1rem;
    font-weight: 700;
    padding: 13px;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s, filter 0.15s;
    margin-bottom: 4px;
  }
  .btn-room-join:hover:not(:disabled) { filter: brightness(1.08); }
  .btn-room-join:disabled { opacity: 0.5; cursor: not-allowed; }

  .room-guest-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .room-guest-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 10px;
    color: var(--text, #f1f5f9);
    font-size: 0.95rem;
    font-family: inherit;
    padding: 11px 14px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .room-guest-input:focus {
    border-color: var(--accent, #3ecfff);
    box-shadow: 0 0 0 3px rgba(62, 207, 255, 0.15);
  }
  .room-guest-error {
    font-size: 0.78rem;
    color: #f87171;
    margin: 0;
  }
  .btn-room-guest {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text, #f1f5f9);
    font-size: 0.9rem;
    font-weight: 600;
    padding: 11px;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-room-guest:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
  .btn-room-guest:disabled { opacity: 0.4; cursor: not-allowed; }

  .room-back-link {
    margin-top: 18px;
    font-size: 0.8rem;
  }
  .room-back-link a {
    color: var(--mid, #94a3b8);
    text-decoration: none;
  }
  .room-back-link a:hover { color: var(--text, #f1f5f9); }

  /* ── SEO content block ── */
  .room-seo-block {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 clamp(16px, 5vw, 80px) 80px;
  }
  .room-seo-block h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 16px;
    color: var(--text, #f1f5f9);
  }
  .room-seo-block ol {
    color: var(--mid, #94a3b8);
    font-size: 0.9rem;
    line-height: 1.7;
    padding-left: 20px;
    margin-bottom: 16px;
  }
  .room-seo-block p {
    font-size: 0.88rem;
    color: var(--dim, #64748b);
    line-height: 1.6;
  }
  .room-seo-block a {
    color: var(--accent, #3ecfff);
    text-decoration: none;
  }
  .room-seo-block a:hover { text-decoration: underline; }
</style>
