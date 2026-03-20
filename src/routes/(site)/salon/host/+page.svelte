<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';

  let code = $state('');
  let socket;

  // Game state
  let phase         = $state('lobby');
  let players       = $state([]);
  let round         = $state(0);
  let total         = $state(10);
  let timerVal      = $state(0);
  let timerMax      = $state(30);
  let roundEnd      = $state(null);
  let finalScores   = $state([]);
  let settings      = $state({});
  let error         = $state('');
  let autoNextSec   = $state(0);
  let autoNextTimer = null;
  let currentPhrase = $state('');
  let featCount     = $state(0);

  const phrases = [
    'Écoutez bien… 👂', 'Vous le sentez ce titre ? 🎵', 'Chaud devant ! 🔥',
    'Qui sera le premier ? 🏆', 'Concentrez-vous ! 🧠', 'La pression monte… ⏰',
    'Un indice : c\'est de la musique 😅', 'Même les pros suent là… 💦',
    'Ça commence à chauffer ! 🌡️', 'Tournée des grands ducs 👑',
    'Le premier qui trouve gagne tout ! 🎯', 'C\'est maintenant ou jamais… ⚡',
    'Vos oreilles valent de l\'or 🪙', 'Top niveau ce soir ! 🎶',
    'Ça sent la victoire ! 🏅',
  ];

  // YouTube — always in DOM, only visually shown during summary/gameover
  let ytReady          = false;
  let ytPlayer;
  let currentStartSecs = 0;

  const medals = ['🥇', '🥈', '🥉'];

  function pickPhrase() {
    currentPhrase = phrases[Math.floor(Math.random() * phrases.length)];
  }

  function initYT() {
    if (window.YT?.Player) { ytReady = true; return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { ytReady = true; };
  }

  function loadVideo(videoId, startSeconds) {
    currentStartSecs = startSeconds;
    if (ytReady && ytPlayer) {
      ytPlayer.loadVideoById({ videoId, startSeconds, suggestedQuality: 'medium' });
      setTimeout(() => { try { ytPlayer.playVideo(); } catch {} }, 400);
    } else {
      const check = setInterval(() => {
        if (!ytReady) return;
        clearInterval(check);
        ytPlayer = new window.YT.Player('salon-yt-player', {
          height: '100%', width: '100%',
          videoId,
          playerVars: { autoplay: 1, controls: 1, enablejsapi: 1, start: startSeconds, rel: 0, modestbranding: 1 },
          events: { onReady: (e) => e.target.playVideo() },
        });
      }, 200);
    }
  }

  // On reveal: seek back to start of clip and resume playing
  function revealVideo() {
    if (!ytPlayer) return;
    try {
      ytPlayer.seekTo(currentStartSecs, true);
      ytPlayer.playVideo();
    } catch {}
  }

  function connectSocket(roomCode) {
    socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

    socket.on('connect', () => socket.emit('salon_join_host', { code: roomCode }));

    socket.on('salon_host_joined', (data) => {
      settings = data.settings || {};
      players  = data.players || [];
      phase    = data.phase || 'lobby';
      round    = data.currentRound || 0;
      total    = settings.maxRounds || 10;
    });

    socket.on('salon_player_joined', ({ players: p }) => { players = p; });
    socket.on('salon_player_left',   ({ players: p }) => { players = p; });

    socket.on('salon_scores_update', ({ scores }) => {
      players = players.map(pl => {
        const s = scores.find(s => s.username === pl.username);
        return s ? { ...pl, score: s.score } : pl;
      }).sort((a, b) => b.score - a.score);
    });

    socket.on('salon_game_starting', () => { phase = 'starting'; });

    socket.on('salon_round_start', (data) => {
      phase      = 'round';
      round      = data.round;
      total      = data.total;
      featCount  = data.featCount || 0;
      roundEnd   = null;
      clearAutoNext();
      pickPhrase();
      players = players.map(p => ({
        ...p,
        foundThisRound: false, foundArtist: false, foundTitle: false,
        foundFeatCount: 0, totalFeatCount: data.featCount || 0,
      }));
      loadVideo(data.videoId, data.startSeconds);
    });

    socket.on('salon_timer_update', ({ current, max }) => { timerVal = current; timerMax = max; });

    socket.on('salon_player_answered', ({ username, correct, foundArtist, foundTitle, foundFeatCount, totalFeatCount }) => {
      players = players.map(p =>
        p.username === username
          ? {
              ...p,
              foundThisRound: correct,
              foundArtist: foundArtist ?? p.foundArtist,
              foundTitle: foundTitle ?? p.foundTitle,
              foundFeatCount: foundFeatCount ?? p.foundFeatCount ?? 0,
              totalFeatCount: totalFeatCount ?? p.totalFeatCount ?? 0,
            }
          : p
      );
    });

    socket.on('salon_round_end', (data) => {
      phase    = 'summary';
      roundEnd = data;
      // Don't stop video — seek to start and play for the reveal
      setTimeout(revealVideo, 200);

      if (data.scores) {
        const m = Object.fromEntries(data.scores.map(s => [s.username, s.score]));
        players = players.map(p => ({ ...p, score: m[p.username] ?? p.score })).sort((a, b) => b.score - a.score);
      }
      if (!settings.manualNext) startAutoNextCountdown(settings.showAnswerDuration || 7);
    });

    socket.on('salon_game_over', ({ scores }) => {
      phase = 'gameover'; finalScores = scores; clearAutoNext();
    });

    socket.on('salon_restarted', ({ players: p }) => {
      players = p; roundEnd = null; finalScores = []; clearAutoNext();
    });

    socket.on('salon_error', ({ message }) => { error = message; });
  }

  function startAutoNextCountdown(s) {
    autoNextSec = s; clearAutoNext();
    autoNextTimer = setInterval(() => { if (--autoNextSec <= 0) clearAutoNext(); }, 1000);
  }
  function clearAutoNext() { clearInterval(autoNextTimer); autoNextTimer = null; autoNextSec = 0; }
  function startGame()   { socket?.emit('salon_start'); phase = 'starting'; }
  function nextRound()   { socket?.emit('salon_next_round'); clearAutoNext(); }
  function restartGame() { socket?.emit('salon_restart'); }

  function timerPct()  { return timerMax ? Math.max(0, (timerVal / timerMax) * 100) : 100; }
  function timerColor() { const p = timerPct(); return p > 60 ? '#4ade80' : p > 30 ? '#fbbf24' : '#f87171'; }

  function qrUrl(size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent('https://www.zik-music.fr/salon/play?code=' + code)}&bgcolor=ffffff&color=000000`;
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    code = params.get('code')?.toUpperCase() || '';
    if (!code) { window.location.href = '/salon'; return; }
    initYT();
    connectSocket(code);
  });

  onDestroy(() => {
    socket?.disconnect(); clearAutoNext();
    if (ytPlayer?.destroy) ytPlayer.destroy();
  });
</script>

<svelte:head>
  <title>ZIK Salon — Hôte {code}</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/salon.css">
</svelte:head>

<div class="salon-host">

  <!-- Header -->
  <header class="salon-host-header">
    <div class="salon-host-code">
      <img class="salon-host-qr-sm" src={qrUrl(80)} alt="QR" width="40" height="40">
      <div>
        <div class="salon-code-label">Code</div>
        <div class="salon-code-val">{code}</div>
      </div>
    </div>

    <div class="salon-host-url-full">
      zik-music.fr/salon/play?code=<strong style="color:var(--accent2)">{code}</strong>
    </div>

    {#if phase === 'round'}
      <div class="salon-host-round">Manche <strong>{round} / {total}</strong></div>
    {/if}

    <div style="font-size:.8rem;color:var(--mid)">
      {players.length} joueur{players.length !== 1 ? 's' : ''}
    </div>
  </header>

  <!-- Timer bar — zero height when not playing -->
  <div class="salon-timer-bar {phase === 'round' ? 'active' : ''}">
    <div class="salon-timer-fill" style="width:{timerPct()}%;background:{timerColor()}"></div>
  </div>

  <!-- Body: center stage + sidebar -->
  <div class="salon-host-body">

    <div class="salon-host-center">

      <!--
        Stage area: 3 overlapping panels (absolute positioned).
        #salon-yt-player is ALWAYS in the DOM inside the video panel.
        It's just opacity:0 during non-reveal phases so the iframe
        stays loaded and audio keeps playing during rounds.
      -->
      <div class="salon-host-stage">

        <!-- Panel: Lobby -->
        <div class="salon-panel" class:active={phase === 'lobby' || phase === 'starting'}>
          <div class="salon-lobby">
            <div class="salon-lobby-qr-wrap">
              <img src={qrUrl(260)} alt="QR code" width="260" height="260" class="salon-lobby-qr">
            </div>
            <div class="salon-lobby-code">{code}</div>
            <div class="salon-lobby-url">zik-music.fr/salon/play?code={code}</div>
            <div class="salon-lobby-count">
              <span class="salon-player-count">{players.length}</span>
              <span class="salon-lobby-title">joueur{players.length !== 1 ? 's' : ''} connecté{players.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <!-- Panel: Round (timer + visualizer) -->
        <div class="salon-panel" class:active={phase === 'round'}>
          <div class="salon-round-stage">
            <div class="salon-big-timer {timerPct() < 20 ? 'danger' : timerPct() < 40 ? 'warn' : ''}">{timerVal}</div>
            <div class="salon-phrase">{currentPhrase}</div>
            <div class="salon-visualizer">
              {#each {length: 14} as _}<div class="salon-vis-bar"></div>{/each}
            </div>
            {#if players.some(p => p.foundThisRound)}
              <div class="salon-finders">
                {#each players.filter(p => p.foundThisRound) as p}
                  <span class="salon-finder-chip">✓ {p.username}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Panel: Video — always in DOM, active during summary + gameover -->
        <div class="salon-panel" class:active={phase === 'summary' || phase === 'gameover'}>
          <div id="salon-yt-player"></div>
        </div>

      </div>
      <!-- /salon-host-stage -->

      <!-- Info area below stage: changes per phase -->
      <div class="salon-host-info">

        {#if phase === 'summary' && roundEnd}
          <div class="salon-summary">
            <div class="salon-summary-reason">{roundEnd.reason}</div>
            <div class="salon-summary-answer">{roundEnd.answer}</div>
            {#if roundEnd.featArtists?.length}
              <div style="font-size:.8rem;color:var(--mid);margin-top:4px">feat. {roundEnd.featArtists.join(', ')}</div>
            {/if}
            {#if roundEnd.firstFinder}
              <div class="salon-summary-first">🏆 Premier : {roundEnd.firstFinder}</div>
            {/if}
            {#if roundEnd.cover}
              <img src={roundEnd.cover} alt="" class="salon-summary-cover">
            {/if}
          </div>
          <div class="salon-scores-table">
            {#each players as p, i}
              <div class="salon-scores-row {i < 3 ? 'top' : ''}">
                <div class="salon-scores-medal">{medals[i] || `#${i+1}`}</div>
                <div class="salon-scores-name">{p.username}</div>
                <div class="salon-scores-pts">{p.score} pts</div>
              </div>
            {/each}
          </div>

        {:else if phase === 'gameover'}
          <div class="salon-gameover">
            <h2>🏆 Fin de la partie !</h2>
            <div class="salon-scores-table">
              {#each finalScores as p, i}
                <div class="salon-scores-row {i < 3 ? 'top' : ''}">
                  <div class="salon-scores-medal">{medals[i] || `#${i+1}`}</div>
                  <div class="salon-scores-name">{p.username}</div>
                  <div class="salon-scores-pts">{p.score} pts</div>
                </div>
              {/each}
            </div>
            <div class="salon-gameover-actions">
              <button class="btn-salon-start" onclick={restartGame}>🔄 Rejouer</button>
              <button class="btn-salon-next" onclick={() => window.location.href = '/salon'}>Nouveau salon</button>
            </div>
          </div>

        {:else}
          <!-- Placeholder to keep info area stable during round/lobby -->
          <div class="salon-info-placeholder"></div>
        {/if}

        {#if error}
          <p style="color:var(--danger);font-size:.9rem;text-align:center">{error}</p>
        {/if}

      </div>

    </div>
    <!-- /salon-host-center -->

    <!-- Sidebar: players with per-element found indicators -->
    <div class="salon-host-sidebar">
      <div class="salon-sidebar-title">Joueurs</div>
      <div class="salon-players-list">
        {#each players as p, i (p.username)}
          <div class="salon-player-row">
            <div class="salon-player-rank">{i + 1}</div>
            <div class="salon-player-name">{p.username}</div>
            <div class="salon-player-score">{p.score ?? 0}</div>
            {#if phase === 'round' || phase === 'summary'}
              <div class="salon-player-found">
                {#if p.foundArtist}<span class="found-el" title="Artiste">🎤</span>{:else}<span class="found-el empty">🎤</span>{/if}
                {#if (p.totalFeatCount || 0) > 0}
                  {#if (p.foundFeatCount || 0) > 0}<span class="found-el" title="Feat">{p.foundFeatCount}🎸</span>{:else}<span class="found-el empty">🎸</span>{/if}
                {/if}
                {#if p.foundTitle}<span class="found-el" title="Titre">🎵</span>{:else}<span class="found-el empty">🎵</span>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

  </div>
  <!-- /salon-host-body -->

  <!-- Footer -->
  <footer class="salon-host-footer">
    {#if phase === 'lobby'}
      <button class="btn-salon-start" onclick={startGame} disabled={players.length === 0}>
        {players.length === 0 ? 'En attente de joueurs…' : '▶ Lancer la partie'}
      </button>
    {:else if phase === 'summary'}
      {#if settings.manualNext}
        <button class="btn-salon-next" onclick={nextRound}>Manche suivante →</button>
      {:else if autoNextSec > 0}
        <div class="salon-auto-next">
          Manche suivante dans <strong>{autoNextSec}s</strong>…
          <button class="btn-salon-next" onclick={nextRound} style="margin-left:12px">Maintenant →</button>
        </div>
      {/if}
    {/if}
  </footer>

</div>
