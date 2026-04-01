<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import HostCenter from './HostCenter.svelte';
  import PlayerSidebar from './PlayerSidebar.svelte';

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

  /** @type {HostCenter} */
  let hostCenter;

  const phrases = [
    'Écoutez bien… 👂', 'Vous le sentez ce titre ? 🎵', 'Chaud devant ! 🔥',
    'Qui sera le premier ? 🏆', 'Concentrez-vous ! 🧠', 'La pression monte… ⏰',
    "Un indice : c'est de la musique 😅", 'Même les pros suent là… 💦',
    'Ça commence à chauffer ! 🌡️', 'Tournée des grands ducs 👑',
    'Le premier qui trouve gagne tout ! 🎯', "C'est maintenant ou jamais… ⚡",
    "Vos oreilles valent de l'or 🪙", 'Top niveau ce soir ! 🎶',
    'Ça sent la victoire ! 🏅',
  ];

  function pickPhrase() {
    currentPhrase = phrases[Math.floor(Math.random() * phrases.length)];
  }

  function timerPct()   { return timerMax ? Math.max(0, (timerVal / timerMax) * 100) : 100; }
  function timerColor() { const p = timerPct(); return p > 60 ? '#4ade80' : p > 30 ? '#fbbf24' : '#f87171'; }

  function qrUrl(size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent('https://www.zik-music.fr/salon/play?code=' + code)}&bgcolor=ffffff&color=000000`;
  }

  function startAutoNextCountdown(s) {
    autoNextSec = s; clearAutoNext();
    autoNextTimer = setInterval(() => { if (--autoNextSec <= 0) clearAutoNext(); }, 1000);
  }
  function clearAutoNext() { clearInterval(autoNextTimer); autoNextTimer = null; autoNextSec = 0; }
  function startGame()   { socket?.emit('salon_start'); phase = 'starting'; }
  function nextRound()   { socket?.emit('salon_next_round'); clearAutoNext(); }
  function restartGame() { socket?.emit('salon_restart'); }

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
      phase    = 'round';
      round    = data.round;
      total    = data.total;
      roundEnd = null;
      clearAutoNext();
      pickPhrase();
      players = players.map(p => ({
        ...p,
        foundThisRound: false, answeredThisRound: false,
        foundArtist: false, foundTitle: false,
        foundFeatCount: 0, totalFeatCount: data.featCount || 0,
      }));
      hostCenter?.loadVideo(data.videoId, data.startSeconds);
    });

    socket.on('salon_timer_started', ({ max }) => { timerVal = max; timerMax = max; });
    socket.on('salon_timer_update', ({ current, max }) => { timerVal = current; timerMax = max; });

    socket.on('salon_player_answered', ({ username, correct, answered, foundArtist, foundTitle, foundFeatCount, totalFeatCount }) => {
      players = players.map(p =>
        p.username === username
          ? {
              ...p,
              // QCM deferred: `answered` = clicked (no correct/wrong yet)
              // Free mode: `correct` = fully found
              answeredThisRound: answered === true ? true : (p.answeredThisRound || false),
              foundThisRound: correct !== undefined && correct !== null ? correct : p.foundThisRound,
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
      setTimeout(() => hostCenter?.revealVideo(), 200);
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

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    code = params.get('code')?.toUpperCase() || '';
    if (!code) { window.location.href = '/salon'; return; }
    connectSocket(code);
  });

  onDestroy(() => {
    socket?.disconnect();
    clearAutoNext();
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

  <!-- Timer bar -->
  <div class="salon-timer-bar {phase === 'round' ? 'active' : ''}">
    <div class="salon-timer-fill" style="width:{timerPct()}%;background:{timerColor()}"></div>
  </div>

  <!-- Body -->
  <div class="salon-host-body">

    <HostCenter
      bind:this={hostCenter}
      {phase} {code} {timerVal} {timerMax}
      {currentPhrase}
      {players} {roundEnd} {finalScores}
      {round} {total}
      onRestart={restartGame}
      onNewSalon={() => window.location.href = '/salon'}
      onMusicReady={() => socket?.emit('salon_music_ready')}
    />

    <PlayerSidebar {players} {phase} answerMode={settings.answerMode || 'free'} />

  </div>

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
    {#if error}
      <p style="color:var(--danger);font-size:.9rem;text-align:center">{error}</p>
    {/if}
  </footer>

</div>
