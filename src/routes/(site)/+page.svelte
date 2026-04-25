<script>
  import { onMount } from "svelte";
  import { goto } from '$app/navigation';
  import HeroSection from '$lib/components/HeroSection.svelte';
  import GlassCard from '$lib/components/GlassCard.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import RoomCard from '$lib/components/RoomCard.svelte';

  let rooms = $state([]);
  let totalOnline = $state(0);
  let displayOnline = $state(0);
  let displayRooms = $state(0);
  let displayUsers = $state(0);
  let roomCodeVal = $state("");
  let roomCodeErr = $state("");
  let roomCodeLoading = $state(false);

  let pubRooms = $state([]);
  let pubLoading = $state(true);
  let pubQcmRooms = $derived(pubRooms.filter(r => r.game_mode === 'qcm').slice(0, 5));
  let pubClassicRooms = $derived(pubRooms.filter(r => r.game_mode !== 'qcm').slice(0, 5));

  let officialQcmRooms = $derived(rooms.filter(r => r.game_mode === 'qcm'));
  let officialClassicRooms = $derived(rooms.filter(r => r.game_mode !== 'qcm'));

  let weeklyLb = $state([]);
  let eloLb = $state([]);
  let lbLoaded = $state(false);

  let guestOpen = $state(false);
  let guestUsername = $state("");
  let pendingRoom = $state(null);

  let _roomsTimer = null;

  /* ── Compteurs animés ── */
  $effect(() => {
    const target = totalOnline;
    if (target === 0) {
      displayOnline = 0;
      return;
    }
    let raf;
    const start = performance.now();
    const from = displayOnline;
    (function tick(now) {
      const p = Math.min((now - start) / 900, 1);
      displayOnline = Math.round(from + (target - from) * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    })(start);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    const target = rooms.length + pubRooms.length;
    if (target === 0) {
      displayRooms = 0;
      return;
    }
    let raf;
    const start = performance.now();
    const from = displayRooms;
    (function tick(now) {
      const p = Math.min((now - start) / 700, 1);
      displayRooms = Math.round(from + (target - from) * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    })(start);
    return () => cancelAnimationFrame(raf);
  });

  function animateUsers(target) {
    if (target === 0) { displayUsers = 0; return; }
    let raf;
    const start = performance.now();
    const from = displayUsers;
    (function tick(now) {
      const p = Math.min((now - start) / 1000, 1);
      displayUsers = Math.round(from + (target - from) * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    })(start);
  }

  /* ── Scroll reveal (Svelte action) ── */
  function reveal(node, delay = 0) {
    node.style.setProperty("--rd", `${delay}ms`);
    node.classList.add("will-reveal");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          node.classList.add("revealed");
          io.disconnect();
        }
      },
      { threshold: 0.07, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  /* ── Data loading ── */
  async function loadRooms() {
    clearTimeout(_roomsTimer);
    try {
      const res = await fetch("/api/rooms/official");
      const data = await res.json();
      rooms = data.rooms ?? data;
      totalOnline = data.totalOnline ?? rooms.reduce((s, r) => s + (r.online || 0), 0);
    } catch {
      rooms = [];
    }
    if (!document.hidden) _roomsTimer = setTimeout(loadRooms, 30_000);
  }

  async function loadPubRooms() {
    try {
      const res = await fetch("/api/rooms/public");
      const data = await res.json();
      pubRooms = Array.isArray(data) ? data : [];
    } catch {
      pubRooms = [];
    } finally {
      pubLoading = false;
    }
  }

  async function loadLeaderboards() {
    try {
      const [wRes, eRes] = await Promise.all([
        fetch("/api/leaderboard/weekly").then((r) => r.json()),
        fetch("/api/leaderboard/elo").then((r) => r.json()),
      ]);
      weeklyLb = Array.isArray(wRes) ? wRes : [];
      eloLb = Array.isArray(eRes) ? eRes : [];
    } catch (e) {
      roomCodeErr = e.message;
    } finally {
      lbLoaded = true;
    }
  }

  async function joinByCode() {
    roomCodeErr = "";
    const code = roomCodeVal.trim().toUpperCase();
    if (code.length < 4) {
      roomCodeErr = "Code invalide.";
      return;
    }
    roomCodeLoading = true;
    try {
      const r = await fetch(`/api/rooms/custom/${code}`);
      if (!r.ok) {
        const r2 = await fetch(`/api/rooms/${code}`);
        if (!r2.ok) throw new Error("Room introuvable ou expirée.");
      }
      navigateToGame(code);
    } catch (e) {
      roomCodeErr = e.message;
    } finally {
      roomCodeLoading = false;
    }
  }

  function joinRoom(roomId, gameMode = 'classic') {
    pendingRoom = roomId;
    pendingGameMode = gameMode;
    const userId = sessionStorage.getItem("zik_uid");
    const name = sessionStorage.getItem("zik_uname");
    if (userId && name) navigateToGame(roomId, name, userId, false, gameMode);
    else openGuestModal(roomId, gameMode);
  }

  let pendingGameMode = $state('classic');

  function navigateToGame(roomId, username, userId, isGuest, gameMode = 'classic') {
    if (!username) {
      openGuestModal(roomId, gameMode);
      return;
    }
    const p = new URLSearchParams({
      roomId,
      username,
      userId: userId || "",
      isGuest: isGuest ? "1" : "0",
      gameMode,
    });
    window.location.href = `/game?${p}`;
  }

  function openGuestModal(roomId, gameMode = 'classic') {
    pendingRoom = roomId;
    pendingGameMode = gameMode;
    const saved = localStorage.getItem("zik_guest");
    if (saved) guestUsername = saved;
    guestOpen = true;
    setTimeout(
      () => document.getElementById("guestUsernameInput")?.focus(),
      80,
    );
  }

  function confirmGuest() {
    const u = guestUsername.trim();
    if (!u) return;
    localStorage.setItem("zik_guest", u);
    guestOpen = false;
    navigateToGame(pendingRoom, u, null, true, pendingGameMode);
  }

  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": ["WebApplication", "VideoGame"],
      "name": "ZIK — Blind Test Musical",
      "url": "https://www.zik-music.fr/",
      "description": "Jeu de blind test musical multijoueur en ligne. Identifiez les chansons avant tout le monde, importez vos playlists Spotify ou Deezer, et grimpez au classement ELO. Gratuit, sans installation.",
      "applicationCategory": "GameApplication",
      "genre": ["Music", "Quiz", "Trivia"],
      "operatingSystem": "Any",
      "browserRequirements": "Navigateur web moderne (Chrome, Firefox, Safari, Edge)",
      "inLanguage": "fr-FR",
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
      "featureList": [
        "Blind test musical multijoueur en temps réel",
        "Import de playlists Spotify et Deezer",
        "Mode Salon Kahoot-like (QCM sur smartphone)",
        "Classement ELO et statistiques joueur",
        "Rooms privées avec code partageable",
        "Mode invité sans inscription",
        "Playlists personnalisées partageables",
        "Détection intelligente des réponses (accents, fautes de frappe)"
      ],
      "screenshot": "https://www.zik-music.fr/og.png",
      "author": { "@type": "Organization", "name": "ZIK", "url": "https://www.zik-music.fr" }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "ZIK",
      "url": "https://www.zik-music.fr/",
      "description": "Le blind test musical multijoueur gratuit en ligne.",
      "inLanguage": "fr-FR",
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://www.zik-music.fr/rooms?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "ZIK",
      "url": "https://www.zik-music.fr/",
      "logo": "https://www.zik-music.fr/og.png",
      "sameAs": ["https://github.com/Tfoucher5/ZIK"]
    }
  ]);

  async function loadGlobalStats() {
    try {
      const res = await fetch("/api/stats/global");
      const data = await res.json();
      animateUsers(data.users ?? 0);
    } catch { /* non-bloquant */ }
  }

  onMount(() => {
    loadRooms();
    loadPubRooms();
    loadLeaderboards();
    loadGlobalStats();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        loadRooms();
        loadPubRooms();
      }
    });
  });
</script>

<svelte:head>
  <title>ZIK — Blind Test Multijoueur en Ligne Gratuit</title>
  <meta name="description" content="Joue au blind test multijoueur gratuit en ligne. Importe tes playlists Spotify &amp; Deezer, grimpe dans le classement ELO, joue en Mode Salon. Jeu musical en ligne sans inscription." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/" />
  <meta property="og:title" content="ZIK — Blind Test Musical Multijoueur | Gratuit" />
  <meta property="og:description" content="Le blind test musical multijoueur gratuit ! Identifie les chansons avant tout le monde, importe tes playlists Spotify/Deezer, Mode Salon Kahoot-like, classement ELO. Sans installation." />
  <meta property="og:url" content="https://www.zik-music.fr/" />
  <meta name="twitter:title" content="ZIK — Blind Test Musical Multijoueur | Gratuit" />
  <meta name="twitter:description" content="Blind test musical multijoueur gratuit en ligne. Playlists Spotify/Deezer, Mode Salon Kahoot-like, classement ELO. Sans inscription requise." />
  <script type="application/ld+json">{@html jsonLd}</script>
</svelte:head>

<!-- ══════════════════════════════ HERO ══════════════════════════════ -->
<HeroSection
  badge={displayOnline > 0 ? `${displayOnline} joueurs en ligne` : 'Blind Test Multijoueur'}
  title="T'as l'oreille ?"
  titleAccent="Prouve-le."
  subtitle="Multijoueur, temps réel, classements ELO. Prouve que tes oreilles valent mieux que les leurs."
>
  <button class="btn-accent" onclick={() => goto('/rooms')}>Jouer maintenant →</button>
  <button class="btn-ghost" onclick={() => document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})}>Explorer les rooms</button>
</HeroSection>

<!-- ══════════════════════════════ STATS STRIP ══════════════════════════════ -->
<div class="stats-strip">
  <div class="stats-inner">
    <div class="stat-item">
      <span class="stat-value accent">{displayOnline > 0 ? displayOnline : '—'}</span>
      <span class="stat-label">Joueurs live</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-value">{displayRooms || '—'}</span>
      <span class="stat-label">Rooms actives</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-value">{displayUsers || '—'}</span>
      <span class="stat-label">Joueurs inscrits</span>
    </div>
  </div>
</div>

<!-- ══════════════════════════════ FEATURES ══════════════════════════════ -->
<section class="section" use:reveal>
  <div class="section-head">
    <h2>Pourquoi <span class="text-gradient">ZIK</span>&nbsp;?</h2>
    <p class="section-sub">Tout ce qu'il faut pour un blind test parfait, sans prise de tête.</p>
  </div>
  <div class="features-grid">
    <div class="feat-card" use:reveal={0}>
      <div class="feat-icon">🎮</div>
      <div class="feat-body">
        <h3>Multijoueur live</h3>
        <p>Jusqu'à 20 joueurs en simultané, classement mis à jour en temps réel à chaque manche.</p>
      </div>
    </div>
    <div class="feat-card" use:reveal={80}>
      <div class="feat-icon">🎵</div>
      <div class="feat-body">
        <h3>Spotify &amp; Deezer</h3>
        <p>Importe tes playlists en 2 clics — Spotify, Deezer ou saisie manuelle. Aucune limite.</p>
      </div>
    </div>
    <div class="feat-card" use:reveal={160}>
      <div class="feat-icon">📊</div>
      <div class="feat-body">
        <h3>Classement ELO</h3>
        <p>Système de rating dynamique. Grimpe, surveille ta progression, compare-toi aux meilleurs.</p>
      </div>
    </div>
    <div class="feat-card" use:reveal={240}>
      <div class="feat-icon">📺</div>
      <div class="feat-body">
        <h3>Mode Salon</h3>
        <p>Grand écran TV, téléphones comme manettes, QCM style Kahoot. Idéal pour les soirées.</p>
      </div>
    </div>
    <div class="feat-card" use:reveal={80}>
      <div class="feat-icon">⚡</div>
      <div class="feat-body">
        <h3>Sans inscription</h3>
        <p>Mode invité instant — entre un pseudo et c'est parti. Crée un compte pour sauvegarder tes stats.</p>
      </div>
    </div>
    <div class="feat-card" use:reveal={160}>
      <div class="feat-icon">🔒</div>
      <div class="feat-body">
        <h3>Rooms privées</h3>
        <p>Crée ta room, partage un code à 6 lettres. Que tes amis, pas d'inconnus si tu veux.</p>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════ ROOMS OFFICIELLES ══════════════════════════════ -->
<section class="section" id="rooms">
  <div class="section-head" use:reveal>
    <div class="section-head-row">
      <div>
        <h2>Rooms officielles</h2>
        {#if totalOnline > 0}
          <span class="inline-pill">{totalOnline} joueur{totalOnline !== 1 ? 's' : ''} en ligne</span>
        {/if}
      </div>
      <a href="/rooms" class="section-link">Toutes les rooms →</a>
    </div>
  </div>

  <div class="code-join" use:reveal>
    <span class="code-join-label">Code privé</span>
    <div class="code-join-bar">
      <input
        type="text"
        bind:value={roomCodeVal}
        placeholder="ABCD12"
        maxlength="6"
        autocomplete="off"
        spellcheck="false"
        oninput={(e) => { roomCodeVal = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
        onkeypress={(e) => { if (e.key === 'Enter') joinByCode(); }}
      />
      <button class="btn-accent sm" onclick={joinByCode} disabled={roomCodeLoading}>
        {roomCodeLoading ? '…' : 'Rejoindre →'}
      </button>
    </div>
    {#if roomCodeErr}<p class="code-join-err">{roomCodeErr}</p>{/if}
  </div>

  {#if officialClassicRooms.length > 0}
    {#if officialQcmRooms.length > 0}
      <div class="pub-section-head" style="margin-bottom:12px">
        <span class="pub-section-badge">⌨️ Classique — Saisie libre</span>
        <span class="pub-section-hint">Classement ELO</span>
      </div>
    {/if}
    <div class="official-rooms-grid" style={officialQcmRooms.length > 0 ? 'margin-bottom:28px' : ''}>
      {#each officialClassicRooms.slice(0, 5) as room, i}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
        <div class="official-card" role="button" tabindex="0"
          onclick={() => joinRoom(room.id, 'classic')}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && joinRoom(room.id, 'classic')}
          use:reveal={i * 40}>
          <div class="official-card-stripe"></div>
          <div class="official-card-header">
            <span class="official-card-emoji">{room.emoji}</span>
            <span class="official-card-badge">⭐ Officielle</span>
          </div>
          <div class="official-card-name">{room.name}</div>
          {#if room.description}
            <div class="official-card-desc">{room.description}</div>
          {/if}
          <div class="official-card-footer">
            <span class="official-card-online" class:official-online-live={room.online > 0}>
              <span class="official-online-dot" class:live={room.online > 0}></span>
              {room.online > 0 ? `${room.online} en ligne` : 'Disponible'}
            </span>
            <button class="official-card-btn" onclick={(e) => { e.stopPropagation(); joinRoom(room.id, 'classic'); }}>
              Rejoindre →
            </button>
          </div>
        </div>
      {/each}
      <a href="/rooms" class="official-card official-card-more" use:reveal={5 * 40}>
        <span class="card-more-icon">🎮</span>
        <span class="card-more-label">Voir toutes les rooms</span>
        <span class="card-more-arrow">→</span>
      </a>
    </div>
  {/if}

  {#if officialQcmRooms.length > 0}
    <div class="pub-section-head" style="margin-bottom:12px">
      <span class="pub-section-badge pub-section-qcm">🎯 QCM — Casual</span>
      <span class="pub-section-hint">Choix multiple · Pas d'ELO</span>
    </div>
    <div class="official-rooms-grid">
      {#each officialQcmRooms.slice(0, 5) as room, i}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
        <div class="official-card official-card-qcm" role="button" tabindex="0"
          onclick={() => joinRoom(room.id, 'qcm')}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && joinRoom(room.id, 'qcm')}
          use:reveal={i * 40}>
          <div class="official-card-stripe official-card-stripe-qcm"></div>
          <div class="official-card-header">
            <span class="official-card-emoji">{room.emoji}</span>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="official-card-badge">⭐ Officielle</span>
              <span class="official-card-badge-qcm">🎯 QCM</span>
            </div>
          </div>
          <div class="official-card-name">{room.name}</div>
          {#if room.description}
            <div class="official-card-desc">{room.description}</div>
          {/if}
          <div class="official-card-footer">
            <span class="official-card-online" class:official-online-live={room.online > 0}>
              <span class="official-online-dot" class:live={room.online > 0}></span>
              {room.online > 0 ? `${room.online} en ligne` : 'Disponible'}
            </span>
            <button class="official-card-btn official-card-btn-qcm" onclick={(e) => { e.stopPropagation(); joinRoom(room.id, 'qcm'); }}>
              Rejoindre →
            </button>
          </div>
        </div>
      {/each}
      <a href="/rooms" class="official-card official-card-more official-card-more-qcm" use:reveal={5 * 40}>
        <span class="card-more-icon">🎯</span>
        <span class="card-more-label">Voir toutes les rooms QCM</span>
        <span class="card-more-arrow">→</span>
      </a>
    </div>
  {/if}
</section>

<!-- ══════════════════════════════ QCM CTA ══════════════════════════════ -->
<div class="qcm-cta" use:reveal>
  <div class="qcm-cta-inner">
    <div class="qcm-cta-left">
      <span class="qcm-cta-tag">✦ Nouveau · Mode Casual</span>
      <h2 class="qcm-cta-title">Mode QCM</h2>
      <p class="qcm-cta-desc">4 propositions, 1 bonne réponse. Idéal pour jouer sans pression ou initier des amis au blind test. Pas d'ELO, que du plaisir.</p>
      <div class="qcm-cta-actions">
        <a href="/rooms?mode=qcm" class="btn-accent">Voir les rooms QCM →</a>
        <a href="/docs#qcm" class="btn-ghost sm">En savoir plus</a>
      </div>
    </div>
    <div class="qcm-choices-preview" aria-hidden="true">
      <div class="qcm-choice qcm-c0">● Daft Punk — Get Lucky</div>
      <div class="qcm-choice qcm-c1">◆ Pharrell Williams — Happy</div>
      <div class="qcm-choice qcm-c2">▲ Michael Jackson — Thriller</div>
      <div class="qcm-choice qcm-c3">■ The Weeknd — Blinding Lights</div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════ ROOMS PUBLIQUES ══════════════════════════════ -->
{#if pubLoading || pubRooms.length > 0}
<section class="section" id="public-rooms">
  <div class="section-head" use:reveal>
    <div class="section-head-row">
      <div>
        <h2>Rooms en direct</h2>
        {#if !pubLoading}
          {@const activeCount = pubRooms.filter(r => r.online > 0).length}
          {#if activeCount > 0}
            <span class="inline-pill pill-hot">
              <span class="dot-hot"></span>
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </span>
          {/if}
        {/if}
      </div>
      <a href="/rooms" class="section-link">Créer une room →</a>
    </div>
  </div>

  {#if pubLoading}
    <div class="pub-grid">
      {#each Array(6) as _, i}
        <div class="pub-skeleton" style="--i:{i}"></div>
      {/each}
    </div>
  {:else if pubRooms.length === 0}
    <p class="pub-empty">Aucune room publique en ce moment. <a href="/rooms">Crée la première →</a></p>
  {:else}
    {#if pubQcmRooms.length > 0}
      {#if pubClassicRooms.length > 0}
        <div class="pub-section-head">
          <span class="pub-section-badge pub-section-qcm">🎯 QCM — Casual</span>
          <span class="pub-section-hint">Choix multiple · Pas d'ELO</span>
        </div>
      {/if}
      <div class="pub-grid" style={pubClassicRooms.length > 0 ? 'margin-bottom:24px' : ''}>
        {#each pubQcmRooms as room, i (room.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div
            class="pub-card pub-card-qcm"
            class:pub-hot={room.online >= 2}
            class:pub-fire={room.online >= 5}
            style="--i:{i}"
            onclick={() => joinRoom(room.id, 'qcm')}
            role="button"
            tabindex="0"
          >
            <div class="pub-card-top">
              <span class="pub-emoji">{room.emoji}</span>
              <div class="pub-badges">
                <span class="pub-badge-qcm">🎯 QCM</span>
                {#if room.online >= 5}<span class="pub-popular">🔥</span>{/if}
              </div>
            </div>
            <div class="pub-name">{room.name}</div>
            {#if room.host}<div class="pub-host">par <strong>{room.host}</strong></div>{/if}
            {#if room.description}<div class="pub-desc">{room.description}</div>{/if}
            <div class="pub-footer">
              <span class="pub-online" class:pub-online-live={room.online > 0}>
                <span class="pub-dot" class:pub-dot-live={room.online > 0}></span>
                {room.online > 0 ? `${room.online} en ligne` : 'Vide'}
              </span>
              <button class="pub-btn" onclick={(e) => { e.stopPropagation(); joinRoom(room.id, 'qcm'); }}>
                Jouer →
              </button>
            </div>
          </div>
        {/each}
        <a href="/rooms" class="pub-card pub-card-more">
          <span class="card-more-icon">🎯</span>
          <span class="card-more-label">Voir plus de rooms</span>
          <span class="card-more-arrow">→</span>
        </a>
      </div>
    {/if}

    {#if pubClassicRooms.length > 0}
      {#if pubQcmRooms.length > 0}
        <div class="pub-section-head">
          <span class="pub-section-badge">⌨️ Classique</span>
          <span class="pub-section-hint">Saisie libre · Classement ELO</span>
        </div>
      {/if}
      <div class="pub-grid">
        {#each pubClassicRooms as room, i (room.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div
            class="pub-card"
            class:pub-hot={room.online >= 2}
            class:pub-fire={room.online >= 5}
            style="--i:{i}"
            onclick={() => joinRoom(room.id, 'classic')}
            role="button"
            tabindex="0"
          >
            <div class="pub-card-top">
              <span class="pub-emoji">{room.emoji}</span>
              {#if room.online >= 5}
                <span class="pub-popular">🔥 Populaire</span>
              {/if}
            </div>
            <div class="pub-name">{room.name}</div>
            {#if room.host}<div class="pub-host">par <strong>{room.host}</strong></div>{/if}
            {#if room.description}<div class="pub-desc">{room.description}</div>{/if}
            <div class="pub-footer">
              <span class="pub-online" class:pub-online-live={room.online > 0}>
                <span class="pub-dot" class:pub-dot-live={room.online > 0}></span>
                {room.online > 0 ? `${room.online} en ligne` : 'Vide'}
              </span>
              <button class="pub-btn" onclick={(e) => { e.stopPropagation(); joinRoom(room.id, 'classic'); }}>
                Jouer →
              </button>
            </div>
          </div>
        {/each}
        <a href="/rooms" class="pub-card pub-card-more">
          <span class="card-more-icon">🎮</span>
          <span class="card-more-label">Voir plus de rooms</span>
          <span class="card-more-arrow">→</span>
        </a>
      </div>
    {/if}
  {/if}
</section>
{/if}

<!-- ══════════════════════════════ MODE SALON CTA ══════════════════════════════ -->
<div class="salon-cta" use:reveal>
  <div class="salon-cta-inner">
    <div class="salon-cta-left">
      <span class="salon-cta-tag">✦ Pour les soirées</span>
      <h2 class="salon-cta-title">Mode Salon</h2>
      <p class="salon-cta-desc">Grand écran sur la TV, chaque joueur répond depuis son téléphone. Idéal pour les soirées entre amis — style Kahoot, mais avec tes musiques.</p>
      <div class="salon-cta-actions">
        <a href="/salon" class="btn-accent">Lancer une session →</a>
        <a href="/docs#salon" class="btn-ghost sm">En savoir plus</a>
      </div>
    </div>
    <div class="salon-cta-phones" aria-hidden="true">
      <div class="sphone sphone-left">
        <div class="sphone-screen"><span class="sphone-shape" style="color:#22c55e">▲</span></div>
      </div>
      <div class="sphone sphone-center">
        <div class="sphone-screen"><span class="sphone-shape" style="color:#f59e0b">◆</span></div>
      </div>
      <div class="sphone sphone-right">
        <div class="sphone-screen"><span class="sphone-shape" style="color:#3b82f6">●</span></div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════ CLASSEMENTS ══════════════════════════════ -->
<section class="section" id="leaderboards">
  <div class="section-head" use:reveal>
    <h2>Classements</h2>
    <p class="section-sub">Les meilleurs joueurs de la semaine et de tous les temps.</p>
  </div>
  <div class="lb-grid">
    <!-- Weekly -->
    <div class="lb-panel" use:reveal={0}>
      <div class="lb-head">
        <span class="lb-head-icon">🏆</span>
        <div>
          <b>Cette semaine</b>
          <small>Points sur 7 jours</small>
        </div>
      </div>

      {#if weeklyLb.length >= 3}
        <div class="podium">
          <!-- 2e -->
          <div class="podium-slot">
            <div class="podium-info">
              <a href="/user/{weeklyLb[1].username}" class="podium-avatar-link">
                {#if weeklyLb[1].avatar_url}
                  <img class="podium-avatar" src={weeklyLb[1].avatar_url} alt={weeklyLb[1].username} width="40" height="40" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{weeklyLb[1].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name">{weeklyLb[1].username}</div>
              <div class="podium-score">{weeklyLb[1].weekly_score} pts</div>
            </div>
            <div class="podium-step podium-step-2"><span class="podium-num">2</span></div>
          </div>
          <!-- 1er -->
          <div class="podium-slot">
            <span class="podium-crown">👑</span>
            <div class="podium-info">
              <a href="/user/{weeklyLb[0].username}" class="podium-avatar-link">
                {#if weeklyLb[0].avatar_url}
                  <img class="podium-avatar" src={weeklyLb[0].avatar_url} alt={weeklyLb[0].username} width="48" height="48" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{weeklyLb[0].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name podium-name-1">{weeklyLb[0].username}</div>
              <div class="podium-score">{weeklyLb[0].weekly_score} pts</div>
            </div>
            <div class="podium-step podium-step-1"><span class="podium-num">1</span></div>
          </div>
          <!-- 3e -->
          <div class="podium-slot">
            <div class="podium-info">
              <a href="/user/{weeklyLb[2].username}" class="podium-avatar-link">
                {#if weeklyLb[2].avatar_url}
                  <img class="podium-avatar" src={weeklyLb[2].avatar_url} alt={weeklyLb[2].username} width="36" height="36" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{weeklyLb[2].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name">{weeklyLb[2].username}</div>
              <div class="podium-score">{weeklyLb[2].weekly_score} pts</div>
            </div>
            <div class="podium-step podium-step-3"><span class="podium-num">3</span></div>
          </div>
        </div>
      {/if}

      <div class="lb-scroll">
        {#if weeklyLb.length === 0}
          <p class="lb-empty">{lbLoaded ? 'Aucune partie cette semaine… pour l\'instant !' : 'Chargement…'}</p>
        {:else}
          {#each weeklyLb.slice(weeklyLb.length >= 3 ? 3 : 0) as p, i}
            {@const rank = (weeklyLb.length >= 3 ? 3 : 0) + i}
            <div class="lb-row">
              <span class="lb-rank">#{rank + 1}</span>
              <a href="/user/{p.username}" class="lb-name">{p.username}</a>
              <span class="lb-score">{p.weekly_score} pts</span>
              <span class="lb-games">{p.games_count} parties</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- ELO -->
    <div class="lb-panel" use:reveal={100}>
      <div class="lb-head">
        <span class="lb-head-icon">⚡</span>
        <div>
          <b>Classement ELO</b>
          <small>All-time</small>
        </div>
      </div>

      {#if eloLb.length >= 3}
        <div class="podium">
          <div class="podium-slot">
            <div class="podium-info">
              <a href="/user/{eloLb[1].username}" class="podium-avatar-link">
                {#if eloLb[1].avatar_url}
                  <img class="podium-avatar" src={eloLb[1].avatar_url} alt={eloLb[1].username} width="40" height="40" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{eloLb[1].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name">{eloLb[1].username}</div>
              <div class="podium-score">{eloLb[1].elo}</div>
            </div>
            <div class="podium-step podium-step-2"><span class="podium-num">2</span></div>
          </div>
          <div class="podium-slot">
            <span class="podium-crown">👑</span>
            <div class="podium-info">
              <a href="/user/{eloLb[0].username}" class="podium-avatar-link">
                {#if eloLb[0].avatar_url}
                  <img class="podium-avatar" src={eloLb[0].avatar_url} alt={eloLb[0].username} width="48" height="48" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{eloLb[0].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name podium-name-1">{eloLb[0].username}</div>
              <div class="podium-score">{eloLb[0].elo}</div>
            </div>
            <div class="podium-step podium-step-1"><span class="podium-num">1</span></div>
          </div>
          <div class="podium-slot">
            <div class="podium-info">
              <a href="/user/{eloLb[2].username}" class="podium-avatar-link">
                {#if eloLb[2].avatar_url}
                  <img class="podium-avatar" src={eloLb[2].avatar_url} alt={eloLb[2].username} width="36" height="36" loading="lazy" />
                {:else}
                  <div class="podium-avatar podium-fb">{eloLb[2].username[0].toUpperCase()}</div>
                {/if}
              </a>
              <div class="podium-name">{eloLb[2].username}</div>
              <div class="podium-score">{eloLb[2].elo}</div>
            </div>
            <div class="podium-step podium-step-3"><span class="podium-num">3</span></div>
          </div>
        </div>
      {/if}

      <div class="lb-scroll">
        {#if eloLb.length === 0}
          <p class="lb-empty">{lbLoaded ? 'Aucun joueur classé pour l\'instant.' : 'Chargement…'}</p>
        {:else}
          {#each eloLb.slice(eloLb.length >= 3 ? 3 : 0) as p, i}
            {@const rank = (eloLb.length >= 3 ? 3 : 0) + i}
            <div class="lb-row">
              <span class="lb-rank">#{rank + 1}</span>
              <a href="/user/{p.username}" class="lb-name">{p.username}</a>
              <span class="lb-score">{p.elo}</span>
              <span class="lb-games">{p.games_played} parties</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════ GUEST MODAL ══════════════════════════════ -->
{#if guestOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) guestOpen = false; }}>
    <div class="modal">
      <h2>Jouer en invité</h2>
      <p class="mdesc">
        Ton score ne sera pas sauvegardé.
        <button onclick={() => guestOpen = false}
          style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font:inherit">
          Me connecter →
        </button>
      </p>
      <div class="field">
        <label for="guestUsernameInput">Pseudo</label>
        <input id="guestUsernameInput" type="text" bind:value={guestUsername}
          placeholder="MonPseudo" maxlength="20" autocomplete="off"
          onkeypress={(e) => { if (e.key === 'Enter') confirmGuest(); }} />
      </div>
      <div class="modal-btns">
        <button class="btn-ghost" onclick={() => guestOpen = false}>Annuler</button>
        <button class="btn-accent" onclick={confirmGuest}>Jouer →</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ════════════════════════════ SYSTÈME DE SECTIONS ════════════════════════════ */
  .section {
    padding: 64px clamp(20px, 5vw, 72px);
    max-width: 1240px;
    margin: 0 auto;
    width: 100%;
  }
  .section-head { margin-bottom: 32px; }
  .section-head h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.1;
    margin-bottom: 6px;
  }
  .section-sub {
    font-size: 0.88rem;
    color: var(--mid);
    line-height: 1.6;
  }
  .section-head-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .section-link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
    transition: opacity 0.15s;
    opacity: 0.85;
  }
  .section-link:hover { opacity: 1; }
  .inline-pill {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.67rem; font-weight: 700;
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    color: var(--accent);
    padding: 2px 10px; border-radius: 20px; margin-left: 8px;
    vertical-align: middle;
  }
  .pill-hot { color: #f87171; background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.2); }
  .dot-hot {
    display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: #f87171; box-shadow: 0 0 5px #f87171;
  }

  /* ════════════════════════════ STATS STRIP ════════════════════════════ */
  .stats-strip {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: rgb(var(--c-glass) / 0.02);
    position: relative;
  }
  .stats-strip::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 400px; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.3), transparent);
  }
  .stats-inner {
    display: grid;
    grid-template-columns: 1fr 1px 1fr 1px 1fr;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 clamp(20px, 5vw, 72px);
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 20px 12px;
  }
  .stat-value {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.4rem, 2.5vw, 1.9rem);
    font-weight: 900;
    letter-spacing: -1px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .stat-value.accent { color: var(--accent); }
  .stat-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    text-align: center;
  }
  .stat-sep {
    background: var(--border);
    margin: 16px 0;
  }

  /* ════════════════════════════ FEATURES ════════════════════════════ */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .feat-card {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    transition: background 0.2s, border-color 0.2s;
  }
  .feat-card:hover {
    background: rgb(var(--c-glass) / 0.07);
    border-color: var(--border2);
  }
  .feat-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    background: rgb(var(--c-glass) / 0.06);
    border-radius: 10px;
    border: 1px solid var(--border);
  }
  .feat-body h3 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.92rem;
    font-weight: 700;
    margin-bottom: 5px;
  }
  .feat-body p {
    font-size: 0.8rem;
    color: var(--mid);
    line-height: 1.55;
  }

  /* ════════════════════════════ CODE JOIN ════════════════════════════ */
  .code-join {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    background: rgb(var(--c-glass) / 0.03);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 28px;
  }
  .code-join-label {
    font-size: 0.78rem; font-weight: 700; color: var(--mid); white-space: nowrap;
  }
  .code-join-bar { display: flex; gap: 8px; flex: 1; min-width: 200px; }
  .code-join-bar input {
    flex: 1;
    background: rgb(var(--c-glass) / 0.05);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--text);
    font-size: 0.92rem;
    font-family: "Bricolage Grotesque", sans-serif;
    outline: none;
    letter-spacing: 0.12em;
    font-weight: 800;
  }
  .code-join-bar input:focus {
    border-color: rgb(var(--accent-rgb) / 0.45);
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.1);
  }
  .code-join-err { font-size: 0.75rem; color: #f87171; width: 100%; margin-top: -4px; }

  /* ════════════════════════════ ROOMS GRID ════════════════════════════ */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 10px;
  }

  /* ════════════════════════════ PUBLIC ROOMS ════════════════════════════ */
  .pub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }
  .pub-skeleton {
    height: 100px;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: 12px;
    animation: pulse-glow 1.5s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.1s);
  }
  .pub-card {
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .pub-card:hover {
    background: rgb(var(--c-glass) / 0.08);
    border-color: var(--border2);
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  }
  .pub-card.pub-hot { border-color: rgb(var(--accent-rgb) / 0.2); }
  .pub-card.pub-fire { border-color: rgb(var(--accent-rgb) / 0.32); background: rgb(var(--accent-rgb) / 0.03); }
  .pub-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .pub-emoji { font-size: 1.3rem; }
  .pub-popular {
    font-size: 0.6rem; font-weight: 700; color: var(--accent);
    background: rgb(var(--accent-rgb) / 0.1); border: 1px solid rgb(var(--accent-rgb) / 0.2);
    padding: 2px 7px; border-radius: 20px;
  }
  .pub-name { font-size: 0.86rem; font-weight: 700; margin-bottom: 2px; }
  .pub-host { font-size: 0.7rem; color: var(--dim); margin-bottom: 6px; }
  .pub-desc { font-size: 0.7rem; color: var(--mid); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pub-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px; }
  .pub-online { font-size: 0.68rem; color: var(--dim); display: flex; align-items: center; gap: 4px; }
  .pub-online-live { color: var(--accent); font-weight: 600; }
  .pub-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dim); flex-shrink: 0; }
  .pub-dot-live { background: var(--accent); box-shadow: 0 0 5px var(--accent); }
  .pub-btn {
    font-size: 0.7rem; font-weight: 800; color: var(--accent);
    background: rgb(var(--accent-rgb) / 0.08); border: 1px solid rgb(var(--accent-rgb) / 0.2);
    border-radius: 5px; cursor: pointer; font-family: inherit; padding: 3px 9px;
    transition: background 0.15s;
  }
  .pub-btn:hover { background: rgb(var(--accent-rgb) / 0.16); }
  .pub-empty { font-size: 0.85rem; color: var(--dim); }
  .pub-empty a { color: var(--accent); }
  .pub-section-head {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .pub-section-badge {
    font-size: 0.75rem; font-weight: 700;
    background: rgb(var(--c-glass) / 0.06);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 3px 11px; border-radius: 20px;
  }
  .pub-section-qcm {
    background: rgba(74,222,128,0.08);
    border-color: rgba(74,222,128,0.25);
    color: #4ade80;
  }
  .pub-section-hint { font-size: 0.7rem; color: var(--dim); }
  .pub-card-qcm { border-color: rgba(74,222,128,0.2); background: rgba(74,222,128,0.025); }
  .pub-card-qcm:hover { border-color: rgba(74,222,128,0.35); }
  .pub-badges { display: flex; align-items: center; gap: 4px; }
  .pub-badge-qcm {
    font-size: 0.58rem; font-weight: 700;
    background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.25);
    color: #4ade80; padding: 2px 7px; border-radius: 20px;
  }

  /* ════════════════════════════ MODE SALON CTA ════════════════════════════ */
  .salon-cta {
    margin: 8px clamp(20px, 5vw, 72px) 0;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(62,207,255,0.07) 0%, rgba(167,139,250,0.11) 100%);
    border: 1px solid rgba(167,139,250,0.2);
    padding: 48px clamp(24px, 5vw, 64px);
    position: relative;
    overflow: hidden;
  }
  .salon-cta::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 75% 50%, rgba(167,139,250,0.1) 0%, transparent 55%);
    pointer-events: none;
  }
  .salon-cta-inner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 48px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .salon-cta-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .salon-cta-tag {
    display: inline-flex; width: fit-content;
    font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--accent2);
    background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25);
    padding: 4px 12px; border-radius: 50px;
  }
  .salon-cta-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 900;
    letter-spacing: -1.5px;
    line-height: 1.1;
    color: var(--text);
  }
  .salon-cta-desc {
    font-size: 0.9rem;
    color: var(--mid);
    line-height: 1.65;
    max-width: 420px;
  }
  .salon-cta-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .salon-cta-phones {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }
  .sphone {
    width: 56px; height: 96px;
    background: rgb(var(--c-glass) / 0.12);
    backdrop-filter: blur(8px);
    border: 1px solid rgb(var(--c-glass) / 0.2);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
  .sphone-left  { transform: rotate(-7deg) translateY(10px); }
  .sphone-center { transform: translateY(-8px); }
  .sphone-right { transform: rotate(7deg) translateY(6px); }
  .sphone-screen {
    width: 40px; height: 68px;
    background: rgba(0,0,0,0.45);
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
  }
  .sphone-shape { font-size: 1.5rem; }

  /* ════════════════════════════ QCM CTA ════════════════════════════ */
  .official-card-badge-qcm {
    font-size: 0.58rem;
    font-weight: 700;
    background: rgba(74,222,128,0.1);
    border: 1px solid rgba(74,222,128,0.25);
    color: #4ade80;
    padding: 2px 7px;
    border-radius: 20px;
    margin-right: auto;
  }
  .qcm-cta {
    margin: 0 clamp(20px, 5vw, 72px) 8px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(62,207,255,0.06) 100%);
    border: 1px solid rgba(74,222,128,0.2);
    padding: 48px clamp(24px, 5vw, 64px);
    position: relative;
    overflow: hidden;
  }
  .qcm-cta::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 75% 50%, rgba(74,222,128,0.08) 0%, transparent 55%);
    pointer-events: none;
  }
  .qcm-cta-inner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 48px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .qcm-cta-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .qcm-cta-tag {
    display: inline-flex; width: fit-content;
    font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    color: #4ade80;
    background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.25);
    padding: 4px 12px; border-radius: 50px;
  }
  .qcm-cta-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 900;
    letter-spacing: -1.5px;
    line-height: 1.1;
    color: var(--text);
  }
  .qcm-cta-desc {
    font-size: 0.9rem;
    color: var(--mid);
    line-height: 1.65;
    max-width: 420px;
  }
  .qcm-cta-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .qcm-choices-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
    width: 260px;
  }
  .qcm-choice {
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .qcm-c0 { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #fca5a5; }
  .qcm-c1 { background: rgba(59,130,246,.12); border-color: rgba(59,130,246,.3); color: #93c5fd; }
  .qcm-c2 { background: rgba(234,179,8,.12); border-color: rgba(234,179,8,.3); color: #fde68a; }
  .qcm-c3 { background: rgba(34,197,94,.18); border-color: rgba(34,197,94,.4); color: #4ade80; box-shadow: 0 0 10px rgba(74,222,128,.15); }
  @media (max-width: 900px) {
    .qcm-choices-preview { display: none; }
  }
  @media (max-width: 600px) {
    .qcm-cta { margin: 0 16px 8px; padding: 36px 20px; }
  }

  /* ════════════════════════════ LEADERBOARDS ════════════════════════════ */
  .lb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }
  .lb-panel {
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    position: relative;
  }
  .lb-panel::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    opacity: 0.45;
  }
  .lb-head {
    display: flex; align-items: center; gap: 12px;
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--border);
  }
  .lb-head-icon { font-size: 1.3rem; flex-shrink: 0; }
  .lb-head b { font-size: 0.9rem; font-weight: 700; display: block; }
  .lb-head small { font-size: 0.7rem; color: var(--dim); }

  /* ════ Podium rectangles ════ */
  .podium {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 6px;
    padding: 20px 16px 0;
    border-bottom: 1px solid var(--border);
  }
  .podium-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .podium-crown { font-size: 1rem; margin-bottom: 4px; line-height: 1; }
  .podium-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-bottom: 10px;
  }
  .podium-avatar-link { display: block; }
  .podium-avatar {
    border-radius: 50%; object-fit: cover;
    border: 2px solid var(--border); display: block;
  }
  .podium-fb {
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border-radius: 50%;
    border: 2px solid var(--border);
    font-weight: 700; font-size: 0.85rem; color: var(--text);
  }
  .podium-name {
    font-size: 0.68rem; font-weight: 700; text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
  }
  .podium-name-1 { color: var(--accent); }
  .podium-score { font-size: 0.6rem; color: var(--dim); text-align: center; }

  /* Les marches */
  .podium-step {
    width: 100%;
    border-radius: 6px 6px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .podium-step-1 {
    height: 68px;
    background: linear-gradient(180deg, rgba(62,207,255,0.22) 0%, rgba(62,207,255,0.08) 100%);
    border: 1px solid rgb(var(--accent-rgb) / 0.35);
    border-bottom: none;
  }
  .podium-step-2 {
    height: 48px;
    background: linear-gradient(180deg, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.06) 100%);
    border: 1px solid rgba(148,163,184,0.3);
    border-bottom: none;
  }
  .podium-step-3 {
    height: 32px;
    background: linear-gradient(180deg, rgba(194,119,74,0.18) 0%, rgba(194,119,74,0.06) 100%);
    border: 1px solid rgba(194,119,74,0.3);
    border-bottom: none;
  }
  .podium-num {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.1rem; font-weight: 900;
    color: var(--text); opacity: 0.55;
  }

  /* Avatars tailles par position */
  .podium-slot:nth-child(1) .podium-avatar,
  .podium-slot:nth-child(1) .podium-fb { width: 40px; height: 40px; border-color: #94a3b8; }
  .podium-slot:nth-child(2) .podium-avatar,
  .podium-slot:nth-child(2) .podium-fb {
    width: 52px; height: 52px;
    border-color: var(--accent);
    box-shadow: 0 0 16px rgb(var(--accent-rgb) / 0.3);
  }
  .podium-slot:nth-child(3) .podium-avatar,
  .podium-slot:nth-child(3) .podium-fb { width: 36px; height: 36px; border-color: #c2774a; }

  /* ════ Official room cards ════ */
  .official-rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .official-card {
    position: relative;
    background: linear-gradient(135deg, rgb(var(--c-glass) / 0.06) 0%, rgba(167,139,250,0.04) 100%);
    border: 1px solid rgba(167,139,250,0.25);
    border-radius: 14px;
    padding: 18px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.15s;
    overflow: hidden;
  }
  .official-card::before {
    content: "";
    position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, var(--accent2), var(--accent));
    border-radius: 0 2px 2px 0;
    opacity: 0.7;
  }
  .official-card:hover {
    background: linear-gradient(135deg, rgb(var(--c-glass) / 0.09) 0%, rgba(167,139,250,0.07) 100%);
    border-color: rgba(167,139,250,0.4);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  .official-card:hover::before { opacity: 1; }
  .official-card-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
  }
  .official-card-emoji { font-size: 1.6rem; }
  .official-card-badge {
    font-size: 0.6rem; font-weight: 700;
    color: var(--accent2);
    background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25);
    padding: 2px 9px; border-radius: 20px;
  }
  .official-card-name {
    font-size: 0.92rem; font-weight: 800;
    color: var(--text); margin-bottom: 5px;
  }
  .official-card-desc {
    font-size: 0.75rem; color: var(--mid); line-height: 1.5; margin-bottom: 12px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .official-card-footer {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .official-card-online {
    font-size: 0.68rem; color: var(--dim);
    display: flex; align-items: center; gap: 5px;
  }
  .official-online-dot {
    width: 5px; height: 5px; border-radius: 50%; background: var(--dim); flex-shrink: 0;
  }
  .official-online-dot.live { background: #4ade80; box-shadow: 0 0 5px #4ade80; }
  .official-online-live { color: #4ade80; font-weight: 600; }
  .official-card-btn {
    font-size: 0.72rem; font-weight: 700;
    color: var(--accent2);
    background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25);
    border-radius: 7px; cursor: pointer; font-family: inherit; padding: 5px 12px;
    transition: background 0.15s, border-color 0.15s;
  }
  .official-card-btn:hover { background: rgba(167,139,250,0.18); border-color: rgba(167,139,250,0.4); }
  .official-card-qcm {
    border-color: rgba(74,222,128,0.25);
    background: linear-gradient(135deg, rgb(var(--c-glass) / 0.06) 0%, rgba(74,222,128,0.04) 100%);
  }
  .official-card-qcm:hover { border-color: rgba(74,222,128,0.4); }
  .official-card-stripe-qcm { background: linear-gradient(180deg, #4ade80, #22c55e); }
  .official-card-btn-qcm {
    color: #4ade80;
    background: rgba(74,222,128,0.08);
    border-color: rgba(74,222,128,0.25);
  }
  .official-card-btn-qcm:hover { background: rgba(74,222,128,0.16); border-color: rgba(74,222,128,0.4); }

  /* ════════════════════════════ FAKE "VOIR PLUS" CARDS ════════════════════════════ */
  .official-card-more {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-decoration: none;
    border-style: dashed;
    border-color: rgba(167,139,250,0.2);
    background: transparent;
    color: var(--mid);
    transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
    min-height: 120px;
  }
  .official-card-more:hover {
    background: rgba(167,139,250,0.06);
    border-color: rgba(167,139,250,0.45);
    color: var(--accent2);
    transform: translateY(-2px);
  }
  .official-card-more-qcm {
    border-color: rgba(74,222,128,0.2);
  }
  .official-card-more-qcm:hover {
    background: rgba(74,222,128,0.05);
    border-color: rgba(74,222,128,0.4);
    color: #4ade80;
  }
  .pub-card-more {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    border-style: dashed;
    border-color: rgba(255,255,255,0.1);
    background: transparent;
    color: var(--mid);
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
    min-height: 80px;
  }
  .pub-card-more:hover {
    background: rgb(var(--c-glass) / 0.06);
    border-color: var(--border2);
    color: var(--accent);
    transform: translateY(-2px);
  }
  .card-more-icon { font-size: 1.4rem; }
  .card-more-label { font-size: 0.8rem; font-weight: 700; }
  .card-more-arrow { font-size: 1rem; }

  /* Scrollable list */
  .lb-scroll {
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .lb-scroll::-webkit-scrollbar { width: 4px; }
  .lb-scroll::-webkit-scrollbar-track { background: transparent; }
  .lb-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .lb-empty { padding: 20px; text-align: center; color: var(--dim); font-size: 0.82rem; }
  .lb-row {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px; border-radius: 7px;
    transition: background 0.12s;
  }
  .lb-row:hover { background: rgb(var(--c-glass) / 0.06); }
  .lb-rank { font-size: 0.68rem; font-weight: 700; color: var(--dim); min-width: 26px; font-variant-numeric: tabular-nums; }
  .lb-name { font-size: 0.82rem; font-weight: 600; flex: 1; color: var(--text); transition: color 0.15s; }
  .lb-name:hover { color: var(--accent); }
  .lb-score { font-size: 0.82rem; font-weight: 700; }
  .lb-games { font-size: 0.62rem; color: var(--dim); min-width: 60px; text-align: right; }

  /* ════════════════════════════ GUEST MODAL ════════════════════════════ */
  .overlay {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 16px;
    padding: 28px; width: 100%; max-width: 360px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .modal h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.2rem; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.5px;
  }
  .mdesc { font-size: 0.82rem; color: var(--mid); margin-bottom: 20px; line-height: 1.5; }
  .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 20px; }
  .field label { font-size: 0.75rem; font-weight: 600; color: var(--mid); }
  .field input {
    background: rgb(var(--c-glass) / 0.04); border: 1px solid var(--border2);
    border-radius: 8px; padding: 10px 14px; color: var(--text);
    font-size: 0.88rem; font-family: inherit; outline: none;
  }
  .field input:focus { border-color: rgb(var(--accent-rgb) / 0.4); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08); }
  .modal-btns { display: flex; gap: 8px; justify-content: flex-end; }

  /* ════════════════════════════ RESPONSIVE ════════════════════════════ */
  @media (max-width: 900px) {
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .salon-cta-phones { display: none; }
    .official-rooms-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  }
  @media (max-width: 600px) {
    .section { padding: 44px 16px; }
    .features-grid { grid-template-columns: 1fr; }
    .official-rooms-grid { grid-template-columns: 1fr; }
    .pub-grid { grid-template-columns: 1fr 1fr; }
    .lb-grid { grid-template-columns: 1fr; }
    .stats-inner { grid-template-columns: 1fr 1px 1fr 1px 1fr; max-width: 100%; }
    .salon-cta { margin: 8px 16px 0; padding: 36px 20px; }
    .section-head h2 { font-size: 1.45rem; }
    .podium-step-1 { height: 56px; }
    .podium-step-2 { height: 40px; }
    .podium-step-3 { height: 28px; }
    /* Code-join : bouton sous l'input */
    .code-join { flex-direction: column; align-items: stretch; }
    .code-join-bar { flex-direction: column; min-width: 0; }
    .code-join-bar :global(.btn-accent),
    .code-join-bar button { width: 100%; justify-content: center; }
  }
  @media (max-width: 400px) {
    .pub-grid { grid-template-columns: 1fr; }
    /* Stats strip : réduire le texte pour éviter le débordement */
    .stat-num { font-size: 1.6rem; }
    .stat-label { font-size: 0.58rem; }
  }
</style>
