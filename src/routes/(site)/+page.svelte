<script>
  import { onMount } from "svelte";

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

  let weeklyLb = $state([]);
  let eloLb = $state([]);

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

  function joinRoom(roomId) {
    pendingRoom = roomId;
    const userId = sessionStorage.getItem("zik_uid");
    const name = sessionStorage.getItem("zik_uname");
    if (userId && name) navigateToGame(roomId, name, userId, false);
    else openGuestModal(roomId);
  }

  function navigateToGame(roomId, username, userId, isGuest) {
    if (!username) {
      openGuestModal(roomId);
      return;
    }
    const p = new URLSearchParams({
      roomId,
      username,
      userId: userId || "",
      isGuest: isGuest ? "1" : "0",
    });
    window.location.href = `/game?${p}`;
  }

  function openGuestModal(roomId) {
    pendingRoom = roomId;
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
    navigateToGame(pendingRoom, u, null, true);
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
  <title>ZIK — Blind Test Musical Multijoueur en Ligne | Gratuit</title>
  <meta
    name="description"
    content="Le blind test musical multijoueur gratuit : identifie les chansons avant tout le monde, importe tes playlists Spotify ou Deezer, joue en Mode Salon Kahoot-like et grimpe au classement ELO. Sans installation."
  />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/" />
  <meta
    property="og:title"
    content="ZIK — Blind Test Musical Multijoueur | Gratuit"
  />
  <meta
    property="og:description"
    content="Le blind test musical multijoueur gratuit ! Identifie les chansons avant tout le monde, importe tes playlists Spotify/Deezer, Mode Salon Kahoot-like, classement ELO. Sans installation."
  />
  <meta property="og:url" content="https://www.zik-music.fr/" />
  <meta
    name="twitter:title"
    content="ZIK — Blind Test Musical Multijoueur | Gratuit"
  />
  <meta
    name="twitter:description"
    content="Blind test musical multijoueur gratuit en ligne. Playlists Spotify/Deezer, Mode Salon Kahoot-like, classement ELO. Sans inscription requise."
  />
  <script type="application/ld+json">{@html jsonLd}</script>
  <link rel="stylesheet" href="/css/home.css" />
</svelte:head>

<!-- ═══════════════════════════════════════════════════════════════════════════
     HERO
     ═══════════════════════════════════════════════════════════════════════════ -->
<section class="hero">
  <div class="hero-bg">
    <div class="orb o1"></div>
    <div class="orb o2"></div>
    <div class="orb o3"></div>
  </div>
  <div class="hero-content">
    <!-- Texte -->
    <div class="hero-text">
      <span class="eyebrow">
        <span class="eyebrow-dot"></span>
        Sans inscription &middot; Multijoueur
      </span>
      <h1>Reconnais le son.<br /><em>Domine le classement.</em></h1>
      <p class="hero-sub">
        Identifie les titres avant tout le monde, importe ta playlist Deezer,
        grimpe en ELO. La partie commence&nbsp;maintenant.
      </p>

      <!-- AJOUT TEMPORAIRE DU MESSAGE INFORMATIONS  -->
      <div class="hero-feats">
        <div class="hero-feat"><span>&#x1F3AE;</span> Multijoueur live</div>
        <div class="hero-feat"><span>&#x1F3B5;</span> Spotify &amp; Deezer</div>
        <div class="hero-feat hero-feat-hide-sm">
          <span>&#x1F3C6;</span> Classement ELO
        </div>
        <div class="hero-feat hero-feat-hide-sm">
          <span>&#x26A1;</span> Rooms priv&eacute;es
        </div>
      </div>

      <div class="hero-steps">
        <div class="hero-step">
          <span class="hero-step-num">1</span>
          <div>
            <strong>Choisis une room</strong>
            <small
              >Officielle, publique ou priv&eacute;e — ou cr&eacute;e la tienne</small
            >
          </div>
        </div>
        <div class="hero-step">
          <span class="hero-step-num">2</span>
          <div>
            <strong>&Eacute;coute l&rsquo;extrait</strong>
            <small
              >30 secondes pour identifier le titre avant tes adversaires</small
            >
          </div>
        </div>
        <div class="hero-step">
          <span class="hero-step-num">3</span>
          <div>
            <strong>Grimpe dans le classement</strong>
            <small
              >Gagne des points ELO &agrave; chaque bonne r&eacute;ponse</small
            >
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <button
          class="btn-accent hero-cta"
          onclick={() =>
            document
              .getElementById("rooms")
              ?.scrollIntoView({ behavior: "smooth" })}
        >
          Jouer maintenant <span class="arrow">&rarr;</span>
        </button>
        <a href="/salon" class="btn-ghost hero-cta-sec salon-pill"
          >&#x1F6CB;&#xFE0F; Mode Salon</a
        >
        <a href="/rooms" class="btn-ghost hero-cta-sec hero-cta-explore"
          >Explorer &rarr;</a
        >
      </div>
    </div>

    <!-- Mockup gameplay -->
    <div class="hero-visual" aria-hidden="true">
      <div class="hero-mockup">
        <!-- Topbar -->
        <div class="hm-topbar">
          <span class="hm-live"><span class="dot"></span>EN DIRECT</span>
          <span class="hm-roomname">&#x1F3B5; Pop Hits 2000s</span>
          <span class="hm-count">8 &#x1F465;</span>
        </div>

        <!-- Zone de jeu : pochette + infos manche -->
        <div class="hm-game">
          <div class="hm-album">
            <div class="hm-blob hm-b1"></div>
            <div class="hm-blob hm-b2"></div>
            <div class="hm-blob hm-b3"></div>
            <span class="hm-album-icon">&#x1F3B5;</span>
          </div>
          <div class="hm-round">
            <div class="hm-round-label">
              Manche <b>4</b><span class="hm-round-total">/10</span>
            </div>
            <div class="hm-question-text">Quel est ce titre&nbsp;?</div>
            <div class="hm-input-fake">
              <span class="hm-input-val">chanson d</span><span class="hm-cursor"
              ></span>
            </div>
          </div>
        </div>

        <!-- Barre de timer -->
        <div class="hm-timer-row">
          <div class="hm-timer-wrap"><div class="hm-timer-bar"></div></div>
          <span class="hm-timer-num">12s</span>
        </div>

        <!-- Classement live -->
        <div class="hm-scores">
          <div class="hm-row hm-r1">
            <span class="hm-medal">&#x1F947;</span>
            <span class="hm-uname">MaxDuke</span>
            <div class="hm-typing"><span></span><span></span><span></span></div>
            <span class="hm-pts">1&nbsp;240</span>
          </div>
          <div class="hm-row hm-r2">
            <span class="hm-medal">&#x1F948;</span>
            <span class="hm-uname">Julia_R</span>
            <span class="hm-pts">980</span>
          </div>
          <div class="hm-row hm-r3">
            <span class="hm-medal">&#x1F949;</span>
            <span class="hm-uname">BassHunter</span>
            <div class="hm-typing hm-typing-slow">
              <span></span><span></span><span></span>
            </div>
            <span class="hm-pts">860</span>
          </div>
          <div class="hm-row hm-you">
            <span class="hm-medal">#4</span>
            <span class="hm-uname">Toi&nbsp;?</span>
            <span class="hm-join">Rejoins &rarr;</span>
          </div>
        </div>

        <!-- Modes disponibles -->
        <div class="hm-modes">
          <span class="hm-mtag">&#x1F3AE; Multijoueur</span>
          <span class="hm-mtag hm-mtag-salon">&#x1F6CB;&#xFE0F; Salon</span>
          <span class="hm-mtag">&#x1F512; Priv&eacute;</span>
        </div>

        <!-- Égaliseur -->
        <div class="hm-eq">
          {#each Array(16) as _, i}
            <div class="hm-bar" style="--i:{i}"></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════
     STATS STRIP
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="stats-strip">
  <div class="stats-inner">
    <div class="stat-block">
      <div class="stat-val stat-live">
        {displayOnline > 0 ? displayOnline : "—"}
      </div>
      <div class="stat-label">joueurs en ligne</div>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-block">
      <div class="stat-val">{displayRooms > 0 ? displayRooms : "—"}</div>
      <div class="stat-label">rooms publiques</div>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-block">
      <div class="stat-val">{displayUsers > 0 ? displayUsers : "—"}</div>
      <div class="stat-label">utilisateurs inscrits</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     MODES DE JEU
     ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section modes-section">
  <div class="section-head" use:reveal>
    <h2>Comment jouer</h2>
  </div>
  <div class="modes-grid">
    <div class="mode-card" use:reveal={0}>
      <div class="mode-icon">&#x1F3AE;</div>
      <h3 class="mode-title">Rooms Multijoueur</h3>
      <p class="mode-desc">
        Rejoins une room th&eacute;matique active. Tape le titre avant tout le
        monde et grimpe dans le classement en temps r&eacute;el.
      </p>
      <button
        class="mode-cta"
        onclick={() =>
          document
            .getElementById("rooms")
            ?.scrollIntoView({ behavior: "smooth" })}
      >
        Voir les rooms &rarr;
      </button>
    </div>

    <div class="mode-card mode-card-salon" use:reveal={100}>
      <span class="mode-new-badge">Nouveau</span>
      <div class="mode-icon">&#x1F6CB;&#xFE0F;</div>
      <h3 class="mode-title">Mode Salon</h3>
      <p class="mode-desc">
        Lance une session Kahoot-like sur grand &eacute;cran. Tes amis
        r&eacute;pondent en QCM depuis leur smartphone, en temps r&eacute;el.
      </p>
      <a href="/salon" class="mode-cta mode-cta-salon"
        >Lancer une session &rarr;</a
      >
    </div>

    <div class="mode-card" use:reveal={200}>
      <div class="mode-icon">&#x1F512;</div>
      <h3 class="mode-title">Room Priv&eacute;e</h3>
      <p class="mode-desc">
        Cr&eacute;e ta propre room avec ta playlist Spotify ou Deezer. Partage
        le code &agrave; tes amis pour jouer ensemble.
      </p>
      <a href="/rooms" class="mode-cta">Cr&eacute;er une room &rarr;</a>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════
     ROOMS OFFICIELLES
     ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section" id="rooms">
  <div class="private-room-join" use:reveal>
    <span class="private-room-label">Rejoindre avec un code</span>
    <div class="private-room-bar">
      <input
        type="text"
        bind:value={roomCodeVal}
        placeholder="Code &agrave; 6 lettres"
        maxlength="6"
        autocomplete="off"
        spellcheck="false"
        oninput={(e) => {
          roomCodeVal = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        }}
        onkeypress={(e) => {
          if (e.key === "Enter") joinByCode();
        }}
      />
      <button
        class="btn-join sm"
        onclick={joinByCode}
        disabled={roomCodeLoading}
      >
        {roomCodeLoading ? "..." : "Rejoindre →"}
      </button>
    </div>
    {#if roomCodeErr}<p class="private-room-err">{roomCodeErr}</p>{/if}
  </div>

  <div class="section-head" style="margin-top:40px" use:reveal>
    <h2>Rooms Officielles</h2>
    {#if totalOnline > 0}
      <span class="pill"
        >{totalOnline} joueur{totalOnline !== 1 ? "s" : ""} en ligne</span
      >
    {/if}
    <a href="/rooms" class="section-explore">Explorer toutes les rooms &rarr;</a
    >
  </div>

  <div id="rooms-grid" class="rooms-grid">
    {#each rooms as room, i}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div
        class="room-card"
        style="--rc-color:{room.color};--rc-gradient:{room.gradient}"
        use:reveal={i * 60}
        onclick={() => joinRoom(room.id)}
        role="button"
        tabindex="0"
      >
        <div class="room-stripe"></div>
        <span class="room-official-badge">&#x2713; Officiel</span>
        <div class="room-card-inner">
          <span class="room-emoji">{room.emoji}</span>
          <div class="room-name">{room.name}</div>
          <div class="room-desc">{room.description}</div>
          <div class="room-footer">
            <span class="room-online"
              ><span class="dot"></span>{room.online || 0} en ligne</span
            >
            <button
              class="room-btn"
              onclick={(e) => {
                e.stopPropagation();
                joinRoom(room.id);
              }}>JOUER &rarr;</button
            >
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════
     ROOMS PUBLIQUES
     ═══════════════════════════════════════════════════════════════════════════ -->
{#if pubLoading || pubRooms.length > 0}
  <section class="section pub-section" id="public-rooms">
    <div class="section-head" use:reveal>
      <h2>Rooms en ligne</h2>
      {#if !pubLoading}
        {@const activeCount = pubRooms.filter((r) => r.online > 0).length}
        {#if activeCount > 0}
          <span class="pill pill-hot">
            <span class="dot dot-hot"></span>
            {activeCount} room{activeCount > 1 ? "s" : ""} active{activeCount >
            1
              ? "s"
              : ""}
          </span>
        {/if}
      {/if}
      <a href="/rooms" class="section-explore">Voir toutes les rooms &rarr;</a>
    </div>

    {#if pubLoading}
      <div class="pub-grid">
        {#each Array(6) as _, i}
          <div class="pub-skeleton" style="--i:{i}"></div>
        {/each}
      </div>
    {:else if pubRooms.length === 0}
      <p class="pub-empty">
        Aucune room publique pour l&apos;instant. <a href="/rooms"
          >Cr&eacute;e la premi&egrave;re &rarr;</a
        >
      </p>
    {:else}
      <div class="pub-grid">
        {#each pubRooms as room, i (room.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div
            class="pub-wrap"
            class:pub-hot={room.online >= 2}
            class:pub-fire={room.online >= 5}
            style="--i:{i}"
            onclick={() => joinRoom(room.id)}
            role="button"
            tabindex="0"
          >
            <div class="pub-card">
              <div class="pub-card-header">
                <span class="pub-emoji">{room.emoji}</span>
                {#if room.online >= 5}
                  <span class="pub-fire-badge">&#x1F525; Populaire</span>
                {/if}
              </div>
              <div class="pub-name">{room.name}</div>
              {#if room.host}
                <div class="pub-host">par <strong>{room.host}</strong></div>
              {/if}
              {#if room.description}
                <div class="pub-desc">{room.description}</div>
              {/if}
              <div class="pub-footer">
                <span
                  class="pub-online"
                  class:pub-online-active={room.online > 0}
                >
                  <span class="pub-dot" class:pub-dot-active={room.online > 0}
                  ></span>
                  {room.online > 0 ? `${room.online} en ligne` : "Vide"}
                </span>
                <button
                  class="pub-btn"
                  onclick={(e) => {
                    e.stopPropagation();
                    joinRoom(room.id);
                  }}
                >
                  JOUER &rarr;
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════════
     CLASSEMENTS
     ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section" id="leaderboards">
  <div class="section-head" use:reveal><h2>Classements</h2></div>
  <div class="lb-grid">
    <!-- Weekly -->
    <div class="lb-panel" use:reveal={0}>
      <div class="lb-head">
        <span>&#x1F3C6;</span>
        <div><b>Cette semaine</b><small>Points sur 7 jours</small></div>
      </div>
      {#if weeklyLb.length >= 3}
        <div class="lb-podium">
          <div class="pod-col pod-2">
            <a href="/user/{weeklyLb[1].username}" class="pod-avatar-link">
              {#if weeklyLb[1].avatar_url}
                <img
                  class="pod-avatar"
                  src={weeklyLb[1].avatar_url}
                  alt={weeklyLb[1].username}
                  width="40" height="40"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {weeklyLb[1].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{weeklyLb[1].username}</div>
            <div class="pod-score">{weeklyLb[1].weekly_score} pts</div>
            <div class="pod-bar"><span>&#x1F948;</span></div>
          </div>
          <div class="pod-col pod-1">
            <a href="/user/{weeklyLb[0].username}" class="pod-avatar-link">
              {#if weeklyLb[0].avatar_url}
                <img
                  class="pod-avatar"
                  src={weeklyLb[0].avatar_url}
                  alt={weeklyLb[0].username}
                  width="48" height="48"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {weeklyLb[0].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{weeklyLb[0].username}</div>
            <div class="pod-score">{weeklyLb[0].weekly_score} pts</div>
            <div class="pod-bar"><span>&#x1F947;</span></div>
          </div>
          <div class="pod-col pod-3">
            <a href="/user/{weeklyLb[2].username}" class="pod-avatar-link">
              {#if weeklyLb[2].avatar_url}
                <img
                  class="pod-avatar"
                  src={weeklyLb[2].avatar_url}
                  alt={weeklyLb[2].username}
                  width="40" height="40"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {weeklyLb[2].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{weeklyLb[2].username}</div>
            <div class="pod-score">{weeklyLb[2].weekly_score} pts</div>
            <div class="pod-bar"><span>&#x1F949;</span></div>
          </div>
        </div>
      {/if}
      <div class="lb-body">
        {#if weeklyLb.length === 0}
          <p class="lb-empty">Chargement...</p>
        {:else}
          {#each weeklyLb.slice(weeklyLb.length >= 3 ? 3 : 0) as p, i}
            {@const rank = (weeklyLb.length >= 3 ? 3 : 0) + i}
            <div class="lb-row">
              <div class="lb-rank">#{rank + 1}</div>
              <a href="/user/{p.username}" class="lb-name lb-name-link"
                >{p.username}</a
              >
              <div>
                <div class="lb-score">{p.weekly_score} pts</div>
                <div class="lb-meta">{p.games_count} parties</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- ELO -->
    <div class="lb-panel" use:reveal={120}>
      <div class="lb-head">
        <span>&#x26A1;</span>
        <div><b>Classement ELO</b><small>All-time</small></div>
      </div>
      {#if eloLb.length >= 3}
        <div class="lb-podium">
          <div class="pod-col pod-2">
            <a href="/user/{eloLb[1].username}" class="pod-avatar-link">
              {#if eloLb[1].avatar_url}
                <img
                  class="pod-avatar"
                  src={eloLb[1].avatar_url}
                  alt={eloLb[1].username}
                  width="40" height="40"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {eloLb[1].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{eloLb[1].username}</div>
            <div class="pod-score">{eloLb[1].elo}</div>
            <div class="pod-bar"><span>&#x1F948;</span></div>
          </div>
          <div class="pod-col pod-1">
            <a href="/user/{eloLb[0].username}" class="pod-avatar-link">
              {#if eloLb[0].avatar_url}
                <img
                  class="pod-avatar"
                  src={eloLb[0].avatar_url}
                  alt={eloLb[0].username}
                  width="48" height="48"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {eloLb[0].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{eloLb[0].username}</div>
            <div class="pod-score">{eloLb[0].elo}</div>
            <div class="pod-bar"><span>&#x1F947;</span></div>
          </div>
          <div class="pod-col pod-3">
            <a href="/user/{eloLb[2].username}" class="pod-avatar-link">
              {#if eloLb[2].avatar_url}
                <img
                  class="pod-avatar"
                  src={eloLb[2].avatar_url}
                  alt={eloLb[2].username}
                  width="40" height="40"
                  loading="lazy"
                />
              {:else}
                <div class="pod-avatar pod-avatar-fallback">
                  {eloLb[2].username[0].toUpperCase()}
                </div>
              {/if}
            </a>
            <div class="pod-name">{eloLb[2].username}</div>
            <div class="pod-score">{eloLb[2].elo}</div>
            <div class="pod-bar"><span>&#x1F949;</span></div>
          </div>
        </div>
      {/if}
      <div class="lb-body">
        {#if eloLb.length === 0}
          <p class="lb-empty">Chargement...</p>
        {:else}
          {#each eloLb.slice(eloLb.length >= 3 ? 3 : 0) as p, i}
            {@const rank = (eloLb.length >= 3 ? 3 : 0) + i}
            <div class="lb-row">
              <div class="lb-rank">#{rank + 1}</div>
              <a href="/user/{p.username}" class="lb-name lb-name-link"
                >{p.username}</a
              >
              <div>
                <div class="lb-score">{p.elo}</div>
                <div class="lb-meta">{p.games_played} parties</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════════
     GUEST MODAL
     ═══════════════════════════════════════════════════════════════════════════ -->
{#if guestOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) guestOpen = false;
    }}
  >
    <div class="modal modal-sm">
      <h2>Jouer en invit&eacute;</h2>
      <p class="mdesc">
        Ton score ne sera pas sauvegard&eacute;.
        <button
          class="btn-link"
          onclick={() => (guestOpen = false)}
          style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font:inherit"
        >
          Me connecter &rarr;
        </button>
      </p>
      <div class="field">
        <label for="guestUsernameInput">Pseudo</label>
        <input
          id="guestUsernameInput"
          type="text"
          bind:value={guestUsername}
          placeholder="MonPseudo"
          maxlength="20"
          autocomplete="off"
          onkeypress={(e) => {
            if (e.key === "Enter") confirmGuest();
          }}
        />
      </div>
      <div class="guest-btns">
        <button
          class="btn-ghost"
          onclick={() => {
            guestOpen = false;
          }}>Annuler</button
        >
        <button class="btn-accent" onclick={confirmGuest}>Jouer &rarr;</button>
      </div>
    </div>
  </div>
{/if}
