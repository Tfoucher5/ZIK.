<script>
  import { onMount } from 'svelte';
  import { esc } from '$lib/utils.js';

  let rooms       = $state([]);
  let totalOnline = $state(0);
  let roomCodeVal = $state('');
  let roomCodeErr = $state('');
  let roomCodeLoading = $state(false);

  let weeklyLb = $state([]);
  let eloLb    = $state([]);

  // Guest modal
  let guestOpen     = $state(false);
  let guestUsername = $state('');
  let pendingRoom   = $state(null);

  let _roomsTimer = null;

  async function loadRooms() {
    clearTimeout(_roomsTimer);
    try {
      const res   = await fetch('/api/rooms/official');
      rooms = await res.json();
      totalOnline = rooms.reduce((s, r) => s + (r.online || 0), 0);
    } catch {
      rooms = [];
    }
    if (!document.hidden) _roomsTimer = setTimeout(loadRooms, 30_000);
  }

  async function joinByCode() {
    roomCodeErr = '';
    const code = roomCodeVal.trim().toUpperCase();
    if (code.length < 4) { roomCodeErr = 'Code invalide.'; return; }
    roomCodeLoading = true;
    try {
      // Check if ephemeral custom room exists
      const r = await fetch(`/api/rooms/custom/${code}`);
      if (!r.ok) {
        // Try DB room
        const r2 = await fetch(`/api/rooms/${code}`);
        if (!r2.ok) throw new Error('Room introuvable ou expiree.');
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
    // currentUser is managed by layout — we use event dispatch or check localStorage
    const userId = sessionStorage.getItem('zik_uid');
    const name   = sessionStorage.getItem('zik_uname');
    if (userId && name) {
      navigateToGame(roomId, name, userId, false);
    } else {
      openGuestModal(roomId);
    }
  }

  function navigateToGame(roomId, username, userId, isGuest) {
    if (!username) { openGuestModal(roomId); return; }
    const p = new URLSearchParams({ roomId, username, userId: userId || '', isGuest: isGuest ? '1' : '0' });
    window.location.href = `/game?${p}`;
  }

  function openGuestModal(roomId) {
    pendingRoom = roomId;
    const saved = localStorage.getItem('zik_guest');
    if (saved) guestUsername = saved;
    guestOpen = true;
    setTimeout(() => document.getElementById('guestUsernameInput')?.focus(), 80);
  }

  function confirmGuest() {
    const u = guestUsername.trim();
    if (!u) return;
    localStorage.setItem('zik_guest', u);
    guestOpen = false;
    navigateToGame(pendingRoom, u, null, true);
  }

  async function loadLeaderboards() {
    try {
      const [wRes, eRes] = await Promise.all([
        fetch('/api/leaderboard/weekly').then(r => r.json()),
        fetch('/api/leaderboard/elo').then(r => r.json()),
      ]);
      weeklyLb = Array.isArray(wRes) ? wRes : [];
      eloLb    = Array.isArray(eRes) ? eRes : [];
    } catch {}
  }

  onMount(() => {
    loadRooms();
    loadLeaderboards();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRooms(); });
  });

  const medals = ['🥇', '🥈', '🥉'];
</script>

<svelte:head>
  <title>ZIK — Blind Test Multijoueur en Ligne | Jeu Musical Gratuit</title>
  <meta name="description" content="Joue au blind test musical en ligne avec tes amis ! Identifie les chansons en temps réel, importe tes playlists Spotify ou Deezer, et grimpe au classement ELO. Gratuit, sans installation.">
  <link rel="canonical" href="https://zik.app/">

  <!-- Open Graph -->
  <meta property="og:title" content="ZIK — Blind Test Multijoueur en Ligne">
  <meta property="og:description" content="Joue au blind test musical en ligne avec tes amis ! Identifie les chansons en temps réel, importe tes playlists Spotify ou Deezer, et grimpe au classement ELO. Gratuit, sans installation.">
  <meta property="og:url" content="https://zik.app/">

  <!-- Twitter Card -->
  <meta name="twitter:title" content="ZIK — Blind Test Multijoueur en Ligne">
  <meta name="twitter:description" content="Joue au blind test musical en ligne avec tes amis ! Identifie les chansons en temps réel, importe tes playlists Spotify ou Deezer, et grimpe au classement ELO.">

  <!-- JSON-LD Structured Data -->
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ZIK",
    "url": "https://zik.app",
    "description": "Blind test musical multijoueur en ligne. Identifie les chansons avant tout le monde, importe tes playlists et grimpe au classement ELO.",
    "applicationCategory": "GameApplication",
    "genre": "Music",
    "operatingSystem": "Web",
    "inLanguage": "fr",
    "isAccessibleForFree": true,
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR"
    },
    "featureList": [
      "Blind test multijoueur en temps réel",
      "Import de playlists Spotify et Deezer",
      "Classement ELO",
      "Rooms privées et publiques",
      "Mode invité sans inscription"
    ]
  })}</script>`}

  <link rel="stylesheet" href="/css/home.css">
</svelte:head>

<section class="hero">
  <div class="hero-bg">
    <div class="orb o1"></div>
    <div class="orb o2"></div>
    <div class="orb o3"></div>
  </div>
  <div class="hero-content">
    <span class="eyebrow">&#x1F3B5; Blind Test Multijoueur</span>
    <h1>Prouve que tu<br><em>connais la musique.</em></h1>
    <p class="hero-sub">Rejoins une room, trouve les titres avant tout le monde, grimpe dans le classement.</p>

    <div class="hero-feats">
      <div class="hero-feat"><span>&#x1F3AE;</span> Multijoueur live</div>
      <div class="hero-feat"><span>&#x1F3B5;</span> Tes playlists</div>
      <div class="hero-feat"><span>&#x1F3C6;</span> Classements ELO</div>
      <div class="hero-feat"><span>&#x26A1;</span> Rooms priv&eacute;es</div>
    </div>

    <div class="hero-actions">
      <button class="btn-accent hero-cta" onclick={() => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' })}>
        Jouer maintenant <span class="arrow">&rarr;</span>
      </button>
      <a href="/rooms" class="btn-ghost hero-cta-sec">Explorer les rooms</a>
    </div>
  </div>
</section>

<section class="section" id="rooms">
  <div class="private-room-join">
    <span class="private-room-label">Rejoindre avec un code</span>
    <div class="private-room-bar">
      <input type="text" bind:value={roomCodeVal} placeholder="Code &agrave; 6 lettres" maxlength="6" autocomplete="off" spellcheck="false"
        oninput={e => { roomCodeVal = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
        onkeypress={e => { if (e.key === 'Enter') joinByCode(); }}>
      <button class="btn-accent sm" onclick={joinByCode} disabled={roomCodeLoading}>
        {roomCodeLoading ? '...' : 'Rejoindre →'}
      </button>
    </div>
    {#if roomCodeErr}<p class="private-room-err">{roomCodeErr}</p>{/if}
  </div>

  <div class="section-head" style="margin-top:40px">
    <h2>Rooms Officielles</h2>
    {#if totalOnline > 0}
      <span class="pill">{totalOnline} joueur{totalOnline !== 1 ? 's' : ''} en ligne</span>
    {/if}
    <a href="/rooms" class="section-explore">Explorer toutes les rooms &rarr;</a>
  </div>

  <div id="rooms-grid" class="rooms-grid">
    {#each rooms as room, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="room-card" style="--rc-color:{room.color};--rc-gradient:{room.gradient};animation-delay:{i * 60}ms"
        onclick={() => joinRoom(room.id)} role="button" tabindex="0">
        <div class="room-stripe"></div>
        <div class="room-card-inner">
          <span class="room-emoji">{room.emoji}</span>
          <div class="room-name">{room.name}</div>
          <div class="room-desc">{room.description}</div>
          <div class="room-footer">
            <span class="room-online"><span class="dot"></span>{room.online || 0} en ligne</span>
            <button class="room-btn" onclick={e => { e.stopPropagation(); joinRoom(room.id); }}>JOUER &rarr;</button>
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<section class="section" id="leaderboards">
  <div class="section-head"><h2>Classements</h2></div>
  <div class="lb-grid">
    <div class="lb-panel">
      <div class="lb-head"><span>&#x1F3C6;</span><div><b>Cette semaine</b><small>Points sur 7 jours</small></div></div>
      <div class="lb-body">
        {#if weeklyLb.length === 0}
          <p class="lb-empty">Chargement...</p>
        {:else}
          {#each weeklyLb as p, i}
            <div class="lb-row">
              <div class="lb-rank">{medals[i] || `#${i+1}`}</div>
              <a href="/user/{p.username}" class="lb-name lb-name-link">{p.username}</a>
              <div>
                <div class="lb-score">{p.weekly_score} pts</div>
                <div class="lb-meta">{p.games_count} parties</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
    <div class="lb-panel">
      <div class="lb-head"><span>&#x26A1;</span><div><b>Classement ELO</b><small>All-time</small></div></div>
      <div class="lb-body">
        {#if eloLb.length === 0}
          <p class="lb-empty">Chargement...</p>
        {:else}
          {#each eloLb as p, i}
            <div class="lb-row">
              <div class="lb-rank">{medals[i] || `#${i+1}`}</div>
              <a href="/user/{p.username}" class="lb-name lb-name-link">{p.username}</a>
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

<!-- Guest modal -->
{#if guestOpen}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
<div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
  onclick={e => { if (e.target === e.currentTarget) guestOpen = false; }}>
  <div class="modal modal-sm">
    <h2>Jouer en invit&eacute;</h2>
    <p class="mdesc">Ton score ne sera pas sauvegard&eacute;.
      <button class="btn-link" onclick={() => guestOpen = false} style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font:inherit">Me connecter &rarr;</button>
    </p>
    <div class="field">
      <label for="guestUsernameInput">Pseudo</label>
      <input id="guestUsernameInput" type="text" bind:value={guestUsername} placeholder="MonPseudo" maxlength="20" autocomplete="off"
        onkeypress={e => { if (e.key === 'Enter') confirmGuest(); }}>
    </div>
    <div class="guest-btns">
      <button class="btn-ghost" onclick={() => { guestOpen = false; }}>Annuler</button>
      <button class="btn-accent" onclick={confirmGuest}>Jouer &rarr;</button>
    </div>
  </div>
</div>
{/if}
