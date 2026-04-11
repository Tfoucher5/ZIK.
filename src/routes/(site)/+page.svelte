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
  <title>ZIK — Blind Test Multijoueur en Ligne Gratuit</title>
  <meta name="description" content="Joue au blind test multijoueur gratuit en ligne. Importe tes playlists Spotify &amp; Deezer, grimpe dans le classement ELO, joue en Mode Salon. Jeu musical en ligne sans inscription." />
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
</svelte:head>

<!-- ═══════════════════════════════════════════════════════════════════════════
     HERO
     ═══════════════════════════════════════════════════════════════════════════ -->
<HeroSection
  badge={displayOnline > 0 ? `${displayOnline} joueurs en ligne` : 'Blind Test Multijoueur'}
  title="Le blind test qui"
  titleAccent="t'obsède."
  subtitle="Multijoueur, temps réel, classements ELO. Prouve que tes oreilles valent mieux que les leurs."
>
  <button class="btn-accent" onclick={() => goto('/rooms')}>Jouer maintenant →</button>
  <button class="btn-ghost" onclick={() => document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})}>Explorer les rooms</button>
</HeroSection>

<!-- ═══════════════════════════════════════════════════════════════════════════
     STATS STRIP
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="stats-strip">
  <div class="stats-inner">
    <StatCard value={displayOnline > 0 ? String(displayOnline) : '—'} label="Joueurs live" accent={true} />
    <div class="stat-sep"></div>
    <StatCard value={String(displayRooms || '—')} label="Rooms actives" />
    <div class="stat-sep"></div>
    <StatCard value={String(displayUsers || '—')} label="Joueurs inscrits" />
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     FEATURES
     ═══════════════════════════════════════════════════════════════════════════ -->
<section class="section features-section" use:reveal>
  <div class="section-head will-reveal">
    <h2>Pourquoi <span class="text-gradient">ZIK</span> ?</h2>
  </div>
  <div class="features-grid">
    <div class="will-reveal" use:reveal={100}>
      <GlassCard icon="🎮" title="Multijoueur live" description="Jusqu'à 20 joueurs en simultané, classement en temps réel sur chaque manche." />
    </div>
    <div class="will-reveal" use:reveal={200}>
      <GlassCard icon="🎵" title="Spotify & Deezer" description="Importe tes playlists préférées en quelques clics. Aucune playlist = aucun blind test raté." />
    </div>
    <div class="will-reveal" use:reveal={300}>
      <GlassCard icon="📊" title="Système ELO" description="Grimpe dans les classements, surveille ta courbe de progression, compare-toi aux meilleurs." />
    </div>
    <div class="will-reveal" use:reveal={400}>
      <GlassCard icon="📺" title="Mode Salon" description="Joue en soirée sur grand écran TV. Les joueurs utilisent leur téléphone comme manette." />
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
        class="btn-accent sm"
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
    {#each rooms.slice(0, 6) as room, i}
      <div class="will-reveal" use:reveal={i * 60}>
        <RoomCard
          {room}
          accentColor={room.is_official ? 'var(--accent2)' : 'var(--accent)'}
          onclick={() => joinRoom(room.id)}
        />
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

<style>
  /* ── Stats strip ── */
  .stats-strip {
    padding: 0 clamp(16px, 5vw, 80px);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgb(var(--c-glass) / 0.025) 0%, transparent 100%);
    position: relative;
  }
  .stats-strip::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 280px; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.25), transparent);
  }
  .stats-inner {
    display: flex;
    max-width: 600px;
    margin: 0 auto;
  }
  .stat-sep {
    width: 1px; background: var(--border); flex-shrink: 0; margin: 12px 0;
  }

  /* ── Sections ── */
  .section {
    padding: 72px clamp(16px, 5vw, 80px);
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  .section-head {
    margin-bottom: 36px;
  }
  .section-head h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  /* ── Features grid ── */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  /* ── Rooms grid ── */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }

  @media (max-width: 600px) {
    .section { padding: 48px 16px; }
    .stats-inner { flex-wrap: wrap; }
    .features-grid { grid-template-columns: 1fr; }
    .rooms-grid { grid-template-columns: 1fr; }
  }

  /* ── Leaderboards ── */
  .lb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  .lb-panel {
    background: rgb(var(--c-glass) / 0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .lb-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    font-size: 1.4rem;
  }
  .lb-head b { font-size: 0.9rem; font-weight: 700; display: block; }
  .lb-head small { font-size: 0.72rem; color: var(--dim); }
  .lb-body { padding: 8px; }
  .lb-empty { padding: 16px; text-align: center; color: var(--dim); font-size: 0.82rem; }
  .lb-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .lb-row:hover { background: rgb(var(--c-glass) / 0.05); }
  .lb-rank { font-size: 0.72rem; color: var(--dim); min-width: 28px; }
  .lb-name { font-size: 0.85rem; font-weight: 600; flex: 1; }
  .lb-name-link { color: var(--text); }
  .lb-name-link:hover { color: var(--accent); }
  .lb-score { font-size: 0.82rem; font-weight: 700; text-align: right; }
  .lb-meta { font-size: 0.65rem; color: var(--dim); text-align: right; }

  /* Podium */
  .lb-podium {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 8px;
    padding: 20px 16px 0;
  }
  .pod-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .pod-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border);
  }
  .pod-avatar-link { display: block; }
  .pod-avatar-fallback {
    display: flex; align-items: center; justify-content: center;
    background: var(--surface);
    font-weight: 700; font-size: 0.9rem;
    color: var(--text);
  }
  .pod-1 .pod-avatar { width: 48px; height: 48px; border-color: var(--accent); }
  .pod-name { font-size: 0.72rem; font-weight: 600; text-align: center; }
  .pod-score { font-size: 0.65rem; color: var(--dim); }
  .pod-bar { font-size: 1.1rem; text-align: center; }

  /* ── Public rooms ── */
  .pub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
  .pub-skeleton {
    height: 100px;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    animation: pulse-glow 1.5s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.1s);
  }
  .pub-card {
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .pub-wrap:hover .pub-card { background: rgb(var(--c-glass) / 0.07); border-color: var(--border2); }
  .pub-hot .pub-card { border-color: rgb(var(--accent-rgb) / 0.2); }
  .pub-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .pub-emoji { font-size: 1.3rem; }
  .pub-fire-badge { font-size: 0.65rem; font-weight: 700; color: var(--accent); background: rgb(var(--accent-rgb) / 0.1); padding: 2px 8px; border-radius: 20px; }
  .pub-name { font-size: 0.88rem; font-weight: 700; margin-bottom: 2px; }
  .pub-host { font-size: 0.72rem; color: var(--dim); margin-bottom: 4px; }
  .pub-desc { font-size: 0.72rem; color: var(--mid); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pub-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
  .pub-online { font-size: 0.7rem; color: var(--dim); display: flex; align-items: center; gap: 5px; }
  .pub-online-active { color: var(--accent); }
  .pub-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dim); }
  .pub-dot-active { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
  .pub-btn { font-size: 0.72rem; font-weight: 700; color: var(--accent); background: none; border: none; cursor: pointer; font-family: inherit; padding: 0; }
  .pub-empty { color: var(--dim); font-size: 0.85rem; }

  /* ── Section join by code ── */
  .private-room-join {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 18px;
    margin-bottom: 28px;
  }
  .private-room-label { font-size: 0.82rem; font-weight: 600; color: var(--mid); white-space: nowrap; }
  .private-room-bar { display: flex; gap: 8px; flex: 1; min-width: 220px; }
  .private-room-bar input {
    flex: 1;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--text);
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    letter-spacing: 0.1em;
    font-weight: 700;
  }
  .private-room-bar input:focus {
    border-color: rgb(var(--accent-rgb) / 0.4);
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08);
  }
  .private-room-err { font-size: 0.75rem; color: var(--danger, #f87171); width: 100%; }

  /* ── Section links ── */
  .section-explore { font-size: 0.78rem; color: var(--accent); margin-left: 12px; font-weight: 600; }
  .pill { display: inline-flex; align-items: center; gap: 5px; font-size: 0.68rem; font-weight: 700; background: rgb(var(--accent-rgb) / 0.08); border: 1px solid rgb(var(--accent-rgb) / 0.2); color: var(--accent); padding: 3px 10px; border-radius: 20px; margin-left: 10px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .dot-hot { background: #f87171; box-shadow: 0 0 6px #f87171; }
  .pill-hot { color: #f87171; background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.2); }

  /* ── Guest modal ── */
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
    width: 100%;
    max-width: 400px;
  }
  .modal.modal-sm { max-width: 360px; }
  .modal h2 { font-family: "Bricolage Grotesque", sans-serif; font-size: 1.2rem; font-weight: 800; margin-bottom: 8px; }
  .mdesc { font-size: 0.82rem; color: var(--mid); margin-bottom: 20px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
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
  .field input:focus { border-color: rgb(var(--accent-rgb) / 0.4); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08); }
  .guest-btns { display: flex; gap: 10px; justify-content: flex-end; }
</style>
