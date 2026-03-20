<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';

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
  let answered     = $state(false);
  let guess        = $state('');
  let guessDisabled = $state(true);
  let roundEnd     = $state(null);
  let finalScores  = $state([]);
  let feedback     = $state(null);  // { correct, points }
  let feedbackTimer = null;
  let error        = $state('');

  let socket;

  function timerPct() {
    if (!timerMax) return 100;
    return Math.max(0, (timerVal / timerMax) * 100);
  }

  function timerClass() {
    const p = timerPct();
    if (p < 20) return 'danger';
    if (p < 40) return 'warning';
    return '';
  }

  function showFeedback(data) {
    feedback = data;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { feedback = null; }, 2200);
  }

  function submitGuess() {
    if (guessDisabled || answered || !guess.trim()) return;
    socket.emit('salon_submit_guess', { guess: guess.trim() });
    guess = '';
  }

  function submitChoice(index) {
    if (answered) return;
    answered = true;
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
      joined     = true;
      username   = data.username;
      code       = c;
      answerMode = data.settings?.answerMode || 'free';
      total      = data.settings?.maxRounds || 10;
      phase      = 'lobby';
      joining    = false;
      // Remember for reconnect
      localStorage.setItem('salon_code', c);
      localStorage.setItem('salon_user', u);
    });

    socket.on('salon_game_starting', () => {
      phase = 'starting';
    });

    socket.on('salon_round_start', (data) => {
      phase       = 'round';
      round       = data.round;
      total       = data.total;
      choices     = data.choices || null;
      answered    = false;
      guessDisabled = false;
      roundEnd    = null;
      guess       = '';
      if (answerMode === 'free') {
        setTimeout(() => {
          document.getElementById('salon-guess-input')?.focus();
        }, 100);
      }
    });

    socket.on('salon_timer_update', ({ current, max }) => {
      timerVal = current;
      timerMax = max;
    });

    socket.on('salon_feedback', (data) => {
      showFeedback(data);
      if (data.correct) {
        myScore += data.points;
        answered = true;
        guessDisabled = true;
      }
    });

    socket.on('salon_scores_update', ({ scores: s }) => {
      scores = s;
      const me = s.find(p => p.username === username);
      if (me) myScore = me.score;
    });

    socket.on('salon_round_end', (data) => {
      phase         = 'summary';
      roundEnd      = data;
      guessDisabled = true;
      answered      = true;
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

  const medals = ['🥇', '🥈', '🥉'];

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code')?.toUpperCase() || '';
    if (urlCode) codeInput = urlCode;

    const savedCode = localStorage.getItem('salon_code');
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
  <link rel="stylesheet" href="/css/salon.css">
</svelte:head>

<!-- Join form -->
{#if !joined}
  <div class="salon-join">
    <div class="salon-join-logo">ZIK <span>Salon</span></div>
    <div class="salon-join-card">
      <h2>🛋️ Rejoindre un salon</h2>
      <div class="salon-join-field">
        <label>Code du salon</label>
        <input type="text" bind:value={codeInput} placeholder="ABCDEF" maxlength="6" autocomplete="off" spellcheck="false"
          oninput={e => { codeInput = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
          onkeydown={e => { if (e.key === 'Enter') connectAndJoin(); }}>
      </div>
      <div class="salon-join-field">
        <label>Pseudo</label>
        <input class="normal" type="text" bind:value={usernameInput} placeholder="MonPseudo" maxlength="20" autocomplete="off"
          onkeydown={e => { if (e.key === 'Enter') connectAndJoin(); }}>
      </div>
      {#if joinError}
        <p style="color:var(--danger);font-size:.85rem;text-align:center">{joinError}</p>
      {/if}
      <button class="btn-salon-join" onclick={connectAndJoin} disabled={joining}>
        {joining ? 'Connexion…' : 'Rejoindre →'}
      </button>
    </div>
  </div>

<!-- Game interface -->
{:else}
  <div class="salon-play">

    <!-- Header -->
    <header class="salon-play-header">
      <span class="salon-play-name">{username} · Salon {code}</span>
      <span class="salon-play-score">{myScore} pts</span>
    </header>

    <!-- Timer bar -->
    {#if phase === 'round'}
      <div class="salon-timer-bar">
        <div class="salon-timer-fill" style="width:{timerPct()}%;background:{timerPct() > 60 ? '#4ade80' : timerPct() > 30 ? '#fbbf24' : '#f87171'}"></div>
      </div>
    {/if}

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
        <!-- Round info -->
        <div class="salon-play-round">
          Manche <strong>{round} / {total}</strong>
        </div>

        <!-- Timer circle -->
        <div class="salon-play-timer {timerClass()}">{timerVal}</div>

        <!-- Answer zone -->
        {#if answered}
          <p style="color:var(--mid);font-size:.9rem;text-align:center">Réponse envoyée — en attente des autres…</p>
        {:else if answerMode === 'free'}
          <div class="salon-play-guess">
            <input id="salon-guess-input" type="text" bind:value={guess} placeholder="Artiste ou titre…"
              maxlength="100" autocomplete="off" spellcheck="false"
              disabled={guessDisabled}
              onkeydown={e => { if (e.key === 'Enter') submitGuess(); }}>
            <button class="btn-salon-submit" onclick={submitGuess} disabled={guessDisabled || !guess.trim()}>
              Envoyer
            </button>
          </div>
        {:else if answerMode === 'multiple' && choices}
          <div class="salon-choices">
            {#each choices as choice, i}
              <button class="salon-choice-btn c{i}" onclick={() => submitChoice(i)} disabled={answered}>
                {choice}
              </button>
            {/each}
          </div>
        {/if}

      {:else if phase === 'summary' && roundEnd}
        <div class="salon-play-roundend">
          <img src={roundEnd.cover} alt="" class="cover">
          <div class="answer">{roundEnd.answer}</div>
          {#if roundEnd.firstFinder}
            <p style="font-size:.8rem;color:var(--accent2)">🏆 Premier : {roundEnd.firstFinder}</p>
          {/if}
        </div>

        <!-- Scores -->
        <div class="salon-play-scores">
          {#each (roundEnd.scores || scores) as p, i}
            <div class="salon-play-score-row {p.username === username ? 'me' : ''}">
              <div class="salon-play-score-rank">{medals[i] || `#${i+1}`}</div>
              <div class="salon-play-score-name">{p.username}</div>
              <div class="salon-play-score-pts">{p.score} pts</div>
            </div>
          {/each}
        </div>

      {:else if phase === 'gameover'}
        <p style="font-size:1.3rem;font-weight:800;text-align:center">🏆 Partie terminée !</p>
        <div class="salon-play-scores">
          {#each finalScores as p, i}
            <div class="salon-play-score-row {p.username === username ? 'me' : ''}">
              <div class="salon-play-score-rank">{medals[i] || `#${i+1}`}</div>
              <div class="salon-play-score-name">{p.username}</div>
              <div class="salon-play-score-pts">{p.score} pts</div>
            </div>
          {/each}
        </div>
        <button class="btn-salon-join" onclick={() => { joined = false; codeInput = ''; }} style="margin-top:8px">
          Rejoindre un autre salon
        </button>
      {/if}

      {#if error && joined}
        <p style="color:var(--danger);font-size:.85rem;text-align:center">{error}</p>
      {/if}

    </div>
  </div>

  <!-- Feedback overlay -->
  {#if feedback}
    <div class="salon-feedback">
      <div class="salon-feedback-inner">
        <div class="salon-feedback-emoji">{feedback.correct ? '🎉' : '😔'}</div>
        <div class="salon-feedback-msg {feedback.correct ? 'ok' : 'ko'}">
          {feedback.correct ? 'Trouvé !' : 'Raté…'}
        </div>
        {#if feedback.correct && feedback.points > 0}
          <div class="salon-feedback-pts">+{feedback.points} point{feedback.points > 1 ? 's' : ''}</div>
        {/if}
      </div>
    </div>
  {/if}
{/if}
