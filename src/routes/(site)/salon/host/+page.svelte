<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';

  // URL params
  let code = $state('');
  let socket;

  // Game state
  let phase       = $state('lobby');   // lobby | round | summary | gameover
  let players     = $state([]);
  let round       = $state(0);
  let total       = $state(10);
  let timerVal    = $state(0);
  let timerMax    = $state(30);
  let hostInfo    = $state(null);   // { artist, title, cover, correctChoiceIndex }
  let choices     = $state(null);   // string[] for QCM
  let roundEnd    = $state(null);   // { answer, cover, reason, firstFinder, scores }
  let finalScores = $state([]);
  let settings    = $state({});
  let error       = $state('');
  let autoNextSec = $state(0);
  let autoNextTimer = null;

  // YouTube
  let ytReady = false;
  let ytPlayer;
  let currentVideoId = '';
  let currentStart   = 0;

  const medals = ['🥇', '🥈', '🥉'];

  function initYT() {
    if (window.YT?.Player) { ytReady = true; return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { ytReady = true; };
  }

  function loadVideo(videoId, startSeconds) {
    currentVideoId = videoId;
    currentStart   = startSeconds;
    if (ytReady && ytPlayer) {
      ytPlayer.loadVideoById({ videoId, startSeconds, suggestedQuality: 'medium' });
    } else {
      const checkInterval = setInterval(() => {
        if (!ytReady) return;
        clearInterval(checkInterval);
        ytPlayer = new window.YT.Player('salon-yt-player', {
          videoId,
          playerVars: {
            autoplay: 1, controls: 1, enablejsapi: 1,
            start: startSeconds, rel: 0, modestbranding: 1,
          },
          events: { onReady: (e) => e.target.playVideo() },
        });
      }, 200);
    }
  }

  function stopVideo() {
    if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
  }

  function connectSocket(roomCode) {
    socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

    socket.on('connect', () => {
      socket.emit('salon_join_host', { code: roomCode });
    });

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

    socket.on('salon_game_starting', () => {
      phase = 'starting';
      stopVideo();
    });

    socket.on('salon_round_start', (data) => {
      phase    = 'round';
      round    = data.round;
      total    = data.total;
      choices  = data.choices || null;
      hostInfo = data.hostInfo || null;
      roundEnd = null;
      clearAutoNext();

      // Reset player answered badges
      players = players.map(p => ({ ...p, foundThisRound: false, answeredThisRound: false }));

      loadVideo(data.videoId, data.startSeconds);
    });

    socket.on('salon_timer_update', ({ current, max }) => {
      timerVal = current;
      timerMax = max;
    });

    socket.on('salon_player_answered', ({ username, correct }) => {
      players = players.map(p =>
        p.username === username
          ? { ...p, answeredThisRound: true, foundThisRound: correct }
          : p
      );
    });

    socket.on('salon_round_end', (data) => {
      phase    = 'summary';
      roundEnd = data;
      hostInfo = { ...hostInfo, revealed: true };
      stopVideo();

      // Update scores from round end data
      if (data.scores) {
        const scoreMap = Object.fromEntries(data.scores.map(s => [s.username, s.score]));
        players = players.map(p => ({ ...p, score: scoreMap[p.username] ?? p.score }))
          .sort((a, b) => b.score - a.score);
      }

      if (!settings.manualNext) {
        startAutoNextCountdown(settings.showAnswerDuration || 7);
      }
    });

    socket.on('salon_game_over', ({ scores }) => {
      phase       = 'gameover';
      finalScores = scores;
      stopVideo();
      clearAutoNext();
    });

    socket.on('salon_error', ({ message }) => {
      error = message;
    });
  }

  function startAutoNextCountdown(seconds) {
    autoNextSec = seconds;
    clearAutoNext();
    autoNextTimer = setInterval(() => {
      autoNextSec--;
      if (autoNextSec <= 0) clearAutoNext();
    }, 1000);
  }

  function clearAutoNext() {
    clearInterval(autoNextTimer);
    autoNextTimer = null;
    autoNextSec = 0;
  }

  function startGame() {
    socket?.emit('salon_start');
    phase = 'starting';
  }

  function nextRound() {
    socket?.emit('salon_next_round');
    clearAutoNext();
  }

  function timerPct() {
    if (!timerMax) return 100;
    return Math.max(0, (timerVal / timerMax) * 100);
  }

  function timerColor() {
    const p = timerPct();
    if (p > 60) return '#4ade80';
    if (p > 30) return '#fbbf24';
    return '#f87171';
  }

  function qrUrl() {
    const target = encodeURIComponent(`https://www.zik-music.fr/salon/play?code=${code}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${target}&bgcolor=ffffff&color=000000`;
  }

  function joinUrl() {
    return `zik-music.fr/salon/play?code=${code}`;
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    code = params.get('code')?.toUpperCase() || '';
    if (!code) { window.location.href = '/salon'; return; }
    initYT();
    connectSocket(code);
  });

  onDestroy(() => {
    socket?.disconnect();
    clearAutoNext();
    if (ytPlayer?.destroy) ytPlayer.destroy();
  });
</script>

<svelte:head>
  <title>ZIK Salon — Hôte {code}</title>
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<div class="salon-host">

  <!-- Header -->
  <header class="salon-host-header">
    <div class="salon-host-code">
      <img class="salon-host-qr" src={qrUrl()} alt="QR code" width="64" height="64">
      <div>
        <div class="salon-code-label">Code d'accès</div>
        <div class="salon-code-val">{code}</div>
      </div>
    </div>

    <div class="salon-host-url">
      <span>{joinUrl()}</span>
    </div>

    {#if phase === 'round'}
      <div class="salon-host-round">
        Manche <strong>{round} / {total}</strong>
      </div>
    {/if}

    <div style="font-size:.8rem;color:var(--mid)">
      {players.length} joueur{players.length !== 1 ? 's' : ''}
    </div>
  </header>

  <!-- Timer bar -->
  {#if phase === 'round'}
    <div class="salon-timer-bar">
      <div class="salon-timer-fill" style="width:{timerPct()}%;background:{timerColor()}"></div>
    </div>
  {/if}

  <!-- Body -->
  <div class="salon-host-body">

    <!-- Center -->
    <div class="salon-host-center">

      {#if phase === 'lobby' || phase === 'starting'}
        <!-- Lobby waiting screen -->
        <div class="salon-lobby">
          <div class="salon-player-count">{players.length}</div>
          <div class="salon-lobby-title">joueur{players.length !== 1 ? 's' : ''} connecté{players.length !== 1 ? 's' : ''}</div>
          <div class="salon-lobby-sub">Scannez le QR code ou allez sur <strong style="color:var(--accent2)">{joinUrl()}</strong></div>
        </div>

      {:else if phase === 'round'}
        <!-- YouTube player (visible) -->
        <div class="salon-yt-wrapper">
          <div id="salon-yt-player"></div>
        </div>

        <!-- Prompter (answer for host eyes) -->
        {#if hostInfo}
          <div class="salon-prompter">
            {#if hostInfo.cover}
              <img src={hostInfo.cover} alt="" class="salon-prompter-cover">
            {/if}
            <div class="salon-prompter-info">
              <div class="salon-prompter-artist">{hostInfo.artist}</div>
              <div class="salon-prompter-title">{hostInfo.title}</div>
              {#if choices && hostInfo.correctChoiceIndex !== null}
                <div style="font-size:.78rem;color:var(--accent2);margin-top:4px">
                  ✓ {choices[hostInfo.correctChoiceIndex]}
                </div>
              {/if}
            </div>
          </div>
        {/if}

      {:else if phase === 'summary' && roundEnd}
        <!-- Round summary -->
        <div class="salon-summary">
          <div class="salon-summary-reason">{roundEnd.reason}</div>
          <div class="salon-summary-answer">{roundEnd.answer}</div>
          {#if roundEnd.firstFinder}
            <div class="salon-summary-first">🏆 Premier : {roundEnd.firstFinder}</div>
          {/if}
          {#if roundEnd.cover}
            <img src={roundEnd.cover} alt="" style="width:80px;height:80px;border-radius:8px;margin:12px auto 0;display:block;object-fit:cover">
          {/if}
        </div>

        <!-- Intermediate scores -->
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
          <button class="btn-salon-start" onclick={() => window.location.href = '/salon'}>
            Nouveau salon
          </button>
        </div>
      {/if}

      {#if error}
        <p style="color:var(--danger);font-size:.9rem">{error}</p>
      {/if}

    </div>

    <!-- Sidebar: players -->
    <div class="salon-host-sidebar">
      <div class="salon-sidebar-title">Joueurs</div>
      <div class="salon-players-list">
        {#each players as p, i (p.username)}
          <div class="salon-player-row">
            <div class="salon-player-rank">{i + 1}</div>
            <div class="salon-player-name">{p.username}</div>
            <div class="salon-player-score">{p.score}</div>
            {#if phase === 'round' || phase === 'summary'}
              <div class="salon-player-badge {p.answeredThisRound ? (p.foundThisRound ? 'ok' : 'ko') : 'wait'}">
                {p.answeredThisRound ? (p.foundThisRound ? '✓' : '✗') : '…'}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Footer controls -->
  <footer class="salon-host-footer">
    {#if phase === 'lobby'}
      <button class="btn-salon-start" onclick={startGame} disabled={players.length === 0}>
        {players.length === 0 ? 'En attente de joueurs…' : '▶ Lancer la partie'}
      </button>

    {:else if phase === 'summary'}
      {#if settings.manualNext}
        <button class="btn-salon-next" onclick={nextRound}>
          Manche suivante →
        </button>
      {:else if autoNextSec > 0}
        <div class="salon-auto-next">
          Manche suivante dans <strong>{autoNextSec}s</strong>…
          <button class="btn-salon-next" onclick={nextRound} style="margin-left:12px">Maintenant →</button>
        </div>
      {/if}

    {:else if phase === 'gameover'}
      <!-- handled in center -->
    {/if}
  </footer>
</div>
