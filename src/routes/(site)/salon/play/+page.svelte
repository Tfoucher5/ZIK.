<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import JoinForm from './JoinForm.svelte';
  import RoundPlay from './RoundPlay.svelte';
  import SummaryView from './SummaryView.svelte';
  import FeedbackOverlay from './FeedbackOverlay.svelte';

  // Join form
  let codeInput     = $state('');
  let usernameInput = $state('');
  let joinError     = $state('');
  let joining       = $state(false);

  // Game state
  let joined       = $state(false);
  let username     = $state('');
  let code         = $state('');
  let answerMode   = $state('free');
  let phase        = $state('lobby');
  let round        = $state(0);
  let total        = $state(10);
  let myScore      = $state(0);
  let scores       = $state([]);
  let timerVal     = $state(0);
  let timerMax     = $state(30);
  let choices      = $state(null);

  // Per-element found state
  let foundArtist  = $state(false);
  let foundTitle   = $state(false);
  let foundFeats   = $state([]);
  let allFound     = $state(false);

  let guess        = $state('');
  let roundEnd     = $state(null);
  let finalScores  = $state([]);
  let feedback     = $state(null);
  let feedbackTimer = null;
  let error        = $state('');

  let socket;

  function showFeedback(data) {
    feedback = data;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { feedback = null; }, 2200);
  }

  function submitGuess() {
    if (allFound || !guess.trim()) return;
    socket.emit('salon_submit_guess', { guess: guess.trim() });
    guess = '';
  }

  function submitChoice(index) {
    if (allFound) return;
    allFound = true;
    socket.emit('salon_submit_choice', { choiceIndex: index });
  }

  function connectAndJoin() {
    joinError = '';
    joining = true;

    const c = codeInput.trim().toUpperCase();
    const u = usernameInput.trim();
    if (!c || c.length < 6) { joinError = 'Code invalide.'; joining = false; return; }
    if (!u) { joinError = 'Pseudo requis.'; joining = false; return; }

    socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

    socket.on('connect', () => {
      socket.emit('salon_join_player', { code: c, username: u });
    });

    socket.on('salon_joined', (data) => {
      joined      = true;
      username    = data.username;
      code        = c;
      answerMode  = data.settings?.answerMode || 'free';
      total       = data.settings?.maxRounds || 10;
      phase       = 'lobby';
      joining     = false;
      myScore     = 0;
      scores      = [];
      foundArtist = false;
      foundTitle  = false;
      foundFeats  = [];
      allFound    = false;
      localStorage.setItem('salon_code', c);
      localStorage.setItem('salon_user', u);
    });

    socket.on('salon_game_starting', () => { phase = 'starting'; });

    socket.on('salon_round_start', (data) => {
      phase       = 'round';
      round       = data.round;
      total       = data.total;
      choices     = data.choices || null;
      roundEnd    = null;
      guess       = '';
      foundArtist = false;
      foundTitle  = false;
      foundFeats  = Array(data.featCount || 0).fill(false);
      allFound    = false;
      if (answerMode === 'free') {
        setTimeout(() => { document.getElementById('salon-guess-input')?.focus(); }, 100);
      }
    });

    socket.on('salon_timer_update', ({ current, max }) => { timerVal = current; timerMax = max; });

    socket.on('salon_feedback', (data) => {
      showFeedback(data);
      if (data.correct) {
        myScore += data.points;
        if (data.type === 'success_artist') foundArtist = true;
        else if (data.type === 'success_title') {
          foundTitle = true;
          if (answerMode === 'multiple') foundArtist = true;
        } else if (data.type === 'success_feat') {
          const idx = foundFeats.findIndex(f => !f);
          if (idx !== -1) foundFeats = foundFeats.map((f, i) => i === idx ? true : f);
        }
        allFound = foundArtist && foundTitle && foundFeats.every(Boolean);
      }
    });

    socket.on('salon_scores_update', ({ scores: s }) => {
      scores = s;
      const me = s.find(p => p.username === username);
      if (me) myScore = me.score;
    });

    socket.on('salon_round_end', (data) => {
      phase    = 'summary';
      roundEnd = data;
      allFound = true;
      if (data.scores) scores = data.scores;
    });

    socket.on('salon_game_over', ({ scores: s }) => {
      phase       = 'gameover';
      finalScores = s;
    });

    socket.on('salon_error', ({ message }) => {
      error   = message;
      joining = false;
      if (!joined) {
        joinError = message;
        socket?.disconnect();
      }
    });
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code')?.toUpperCase() || '';
    if (urlCode) codeInput = urlCode;
    const savedUser = localStorage.getItem('salon_user');
    if (savedUser && !usernameInput) usernameInput = savedUser;
  });

  onDestroy(() => {
    socket?.disconnect();
    clearTimeout(feedbackTimer);
  });
</script>

<svelte:head>
  <title>ZIK Salon — Rejoindre</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
</svelte:head>

{#if !joined}
  <JoinForm
    bind:codeInput
    bind:usernameInput
    {joinError}
    {joining}
    onJoin={connectAndJoin}
  />
{:else}
  <div class="salon-play">

    <header class="salon-play-header">
      <span class="salon-play-name">{username} · Salon {code}</span>
      <span class="salon-play-score">{myScore} pts</span>
    </header>

    <div class="salon-play-body">

      {#if phase === 'lobby' || phase === 'starting'}
        <div class="salon-play-lobby">
          <p style="font-size:1rem;font-weight:700">Connecté !</p>
          <p style="color:var(--mid);font-size:.9rem">En attente du lancement par l'hôte…</p>
          <div class="waiting-dots">
            <span>●</span><span>●</span><span>●</span>
          </div>
        </div>

      {:else if phase === 'round'}
        <RoundPlay
          {round} {total}
          {timerVal} {timerMax}
          {answerMode} {choices}
          {foundArtist} {foundTitle} {foundFeats}
          {allFound}
          bind:guess
          onSubmitGuess={submitGuess}
          onSubmitChoice={submitChoice}
        />

      {:else if phase === 'summary' || phase === 'gameover'}
        <SummaryView
          {phase} {roundEnd} {finalScores} {scores} {username}
          onLeave={() => { joined = false; codeInput = ''; }}
        />
      {/if}

      {#if error && joined}
        <p style="color:var(--danger);font-size:.85rem;text-align:center">{error}</p>
      {/if}

    </div>
  </div>

  <FeedbackOverlay {feedback} />
{/if}
