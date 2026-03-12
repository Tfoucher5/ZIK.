<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // URL params — read once on mount
  let ROOM_ID  = 'pop';
  let USERNAME = 'Joueur';
  let USER_ID  = null;
  let IS_GUEST = true;

  // ── Game state ───────────────────────────────────────────────────────────────
  let roomLabel   = $state('');
  let roundInfo   = $state('En attente\u2026');
  let timerPct    = $state(100);
  let timerColor  = $state('var(--accent)');
  let players     = $state([]);
  let history     = $state([]);
  let slotArtist  = $state({ val: '???', state: null });
  let slotTitle   = $state({ val: '???', state: null });
  let featSlots   = $state([]);
  let coverSrc    = $state('');
  let showCover   = $state(false);
  let feedback    = $state({ msg: '', cls: '' });
  let summaryShow = $state(false);
  let summaryReason  = $state('');
  let summaryFinder  = $state('');
  let errorMsg    = $state('');
  let showStart   = $state(true);
  let startDisabled = $state(false);
  let startLabel  = $state('&#x1F3AE; Lancer la partie');
  let gameoverShow = $state(false);
  let gameoverScores = $state([]);
  let guessVal    = $state('');
  let guessDisabled = $state(true);
  let showDcBanner = $state(false);
  let volValue    = $state(50);
  let isAdmin     = $state(false);
  let autoStart   = $state(false);
  let hasOwner    = $state(false);
  let countdownVal = $state(0);
  let showCountdown = $state(false);

  let socket = null;
  let ytPlayer = null;
  let ytReady  = false;
  let pendingLoad = null;
  let _roundActive = false;
  let _hasJoined   = false;
  let _lastVideo   = null;
  let _prevScores  = {};
  let feedTimer    = null;
  let countdownInterval = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function savedVol() { return browser ? parseInt(localStorage.getItem('zik_vol') ?? '50') : 50; }
  function setVol(v) {
    volValue = v;
    if (ytPlayer?.setVolume) ytPlayer.setVolume(v);
    const previewAudio = browser ? document.getElementById('previewAudio') : null;
    if (previewAudio) previewAudio.volume = v / 100;
    document.getElementById('volSlider')?.style.setProperty('--vol', v + '%');
    if (browser) localStorage.setItem('zik_vol', v);
  }

  function loadVideo(videoId, startSeconds) {
    if (!ytReady || !ytPlayer) { pendingLoad = { id: videoId, start: startSeconds }; return; }
    ytPlayer.mute();
    ytPlayer.loadVideoById({ videoId, startSeconds });
  }
  function loadPreview(previewUrl) {
    const audio = document.getElementById('previewAudio');
    if (!audio) return;
    if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
    audio.pause();
    audio.onloadedmetadata = null;
    audio.src = previewUrl;
    audio.volume = savedVol() / 100;
    audio.onloadedmetadata = () => {
      const maxSeek = Math.max(0, Math.min((audio.duration || 30) - 10, 20));
      audio.currentTime = Math.random() * maxSeek;
      audio.play().catch(() => {});
    };
    audio.load();
  }

  function stopVideo() { if (ytReady && ytPlayer) ytPlayer.stopVideo(); }

  function showFeedback(msg, cls) {
    clearTimeout(feedTimer);
    feedback = { msg, cls };
    feedTimer = setTimeout(() => { feedback = { msg: '', cls: '' }; }, 2600);
  }

  function parseFeat(artistStr) {
    if (!artistStr) return { main: '', feat: null };
    const m = artistStr.match(/^(.+?)(?:\s*\((?:feat\.?|ft\.?|featuring)\s+([^)]+)\)|\s+(?:feat\.?|ft\.?|featuring)\s+(.+))$/i);
    if (m) return { main: m[1].trim(), feat: (m[2] || m[3]).trim() };
    const ci = artistStr.indexOf(', ');
    if (ci > 0) return { main: artistStr.slice(0, ci).trim(), feat: artistStr.slice(ci + 2).trim() };
    const am = artistStr.match(/^(.+?)\s+&\s+(.+)$/);
    if (am) return { main: am[1].trim(), feat: am[2].trim() };
    return { main: artistStr, feat: null };
  }

  function requestGame() {
    if (!socket) return;
    socket.emit('request_new_game');
    startDisabled = true;
    startLabel = 'Chargement\u2026';
  }

  function startCountdownUI(seconds) {
    clearInterval(countdownInterval);
    countdownVal = seconds;
    showCountdown = true;
    countdownInterval = setInterval(() => {
      countdownVal--;
      if (countdownVal <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        showCountdown = false;
      }
    }, 1000);
  }

  function stopCountdownUI() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    showCountdown = false;
    countdownVal = 0;
  }

  function submitGuess() {
    const val = guessVal.trim();
    if (val && !guessDisabled && socket) {
      socket.emit('submit_guess', val);
      guessVal = '';
    }
  }

  onMount(async () => {
    const P  = new URLSearchParams(location.search);
    ROOM_ID  = P.get('roomId')   || 'pop';
    USERNAME = P.get('username') || sessionStorage.getItem('zik_uname') || 'Joueur';
    USER_ID  = P.get('userId')   || sessionStorage.getItem('zik_uid')   || null;
    IS_GUEST = P.get('isGuest') === '1' || !USER_ID;

    volValue = savedVol();
    setTimeout(() => document.getElementById('volSlider')?.style.setProperty('--vol', volValue + '%'), 50);

    // Load socket.io dynamically
    const { io } = await import('socket.io-client');
    socket = io({ transports: ['websocket', 'polling'], reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10000 });

    socket.on('connect', () => {
      showDcBanner = false;
      if (_hasJoined) socket.emit('join_room', { roomId: ROOM_ID, username: USERNAME, userId: USER_ID, isGuest: IS_GUEST });
    });
    socket.on('disconnect', () => {
      showDcBanner = true;
      if (_roundActive) stopVideo();
    });

    socket.on('room_joined', ({ roomConfig }) => {
      if (roomConfig) {
        const trackInfo = roomConfig.trackCount ? ` \u2014 ${roomConfig.trackCount} titres` : '';
        roomLabel = `${roomConfig.emoji || ''} ${roomConfig.name || ''}${trackInfo}`.trim();
        autoStart = roomConfig.autoStart || false;
        isAdmin   = roomConfig.isAdmin   || false;
        hasOwner  = roomConfig.hasOwner  || false;
      }
    });
    socket.on('game_countdown', ({ seconds }) => { startCountdownUI(seconds); });
    socket.on('game_countdown_cancelled', () => { stopCountdownUI(); });
    socket.on('track_count_update', count => {
      roomLabel = roomLabel.replace(/ \u2014 \d+ titres$/, '') + ` \u2014 ${count} titres`;
    });
    socket.on('update_players', ps => {
      const sorted = [...ps].sort((a, b) => b.score - a.score);
      players = sorted.map((p, i) => {
        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        const scored = _prevScores[p.name] !== undefined && p.score > _prevScores[p.name];
        const rank   = medals[i] || `#${i+1}`;
        return { ...p, rank, scored };
      });
      ps.forEach(p => { _prevScores[p.name] = p.score; });
    });
    socket.on('init_history', h => { history = Array.isArray(h) ? [...h].reverse() : []; });
    socket.on('game_starting', () => { gameoverShow = false; showStart = false; stopCountdownUI(); });
    socket.on('start_round', data => {
      const featCount = data.featCount || 0;
      featSlots = Array.from({ length: featCount }, () => ({ val: '???', state: null }));
      roundInfo = `Manche ${data.round} / ${data.total}`;
      coverSrc = ''; showCover = false;
      slotArtist = { val: '???', state: null };
      slotTitle  = { val: '???', state: null };
      summaryShow = false; gameoverShow = false; feedback = { msg: '', cls: '' };
      timerPct = 100; timerColor = 'var(--accent)';
      guessDisabled = false; guessVal = '';
      showStart = false; startDisabled = false; startLabel = '\u{1F3AE} Lancer la partie';
      _roundActive = true;
      _lastVideo = { videoId: data.videoId, startSeconds: data.startSeconds, startedAt: Date.now() };
      if (data.previewUrl) {
        loadPreview(data.previewUrl);
      } else {
        loadVideo(data.videoId, data.startSeconds);
      }
      setTimeout(() => document.getElementById('guessInput')?.focus(), 200);
    });
    socket.on('timer_update', ({ current, max }) => {
      timerPct = (current / max) * 100;
      timerColor = timerPct < 30 ? 'var(--danger)' : timerPct < 60 ? '#f59e0b' : 'var(--accent)';
    });
    socket.on('feedback', data => {
      if (data.type === 'success_artist') slotArtist = { val: data.val, state: 'found' };
      if (data.type === 'success_feat') { const fi = data.featIndex ?? 0; featSlots = featSlots.map((s, i) => i === fi ? { val: data.val, state: 'found' } : s); }
      if (data.type === 'success_title') slotTitle = { val: data.val, state: 'found' };
      const cls = data.type === 'miss' ? 'cold' : data.type === 'close' ? 'hot' : 'good';
      showFeedback(data.msg, cls);
    });
    socket.on('reveal_cover', ({ cover }) => { if (cover) { coverSrc = cover; showCover = true; } });
    socket.on('round_end', data => {
      const dashIdx    = data.answer.indexOf(' - ');
      const fullArtist = dashIdx > -1 ? data.answer.slice(0, dashIdx) : data.answer;
      const title      = dashIdx > -1 ? data.answer.slice(dashIdx + 3) : '\u2014';
      const feats      = data.featArtists || [];
      const mainArtist = feats.length ? parseFeat(fullArtist).main : fullArtist;
      slotArtist = { val: mainArtist, state: data.foundArtist ? 'found' : 'missed' };
      featSlots  = feats.map((fa, i) => ({ val: fa, state: (data.foundFeats || [])[i] ? 'found' : 'missed' }));
      slotTitle  = { val: title || '\u2014', state: data.foundTitle ? 'found' : 'missed' };
      if (data.cover) { coverSrc = data.cover; showCover = true; }
      summaryShow = true;
      summaryReason = data.reason;
      summaryFinder = data.totalFound > 0 ? `\u{1F3C6} 1er : ${data.firstFinder} \u2014 ${data.totalFound} joueur(s) ont tout trouv\u00e9` : '\u274C Personne n\u2019a trouv\u00e9';
      _roundActive = false; guessDisabled = true; stopVideo(); timerPct = 0;
      history = [data, ...history];
    });
    socket.on('game_over', scores => {
      _roundActive = false; stopVideo();
      guessDisabled = true; timerPct = 0; summaryShow = false;
      gameoverScores = scores;
      gameoverShow   = true;
    });
    socket.on('server_error', msg => {
      errorMsg = msg;
      setTimeout(() => { errorMsg = ''; }, 4000);
      startDisabled = false; startLabel = '\u{1F3AE} Lancer la partie';
    });

    // Join
    _hasJoined = true;
    socket.emit('join_room', { roomId: ROOM_ID, username: USERNAME, userId: USER_ID, isGuest: IS_GUEST });

    // YouTube
    window.onYouTubeIframeAPIReady = () => {
      ytPlayer = new window.YT.Player('yt-player', {
        height: '1', width: '1',
        playerVars: { autoplay: 1, controls: 0, enablejsapi: 1 },
        events: {
          onReady(e) {
            ytReady = true;
            const v = savedVol();
            e.target.setVolume(v);
            if (pendingLoad) { loadVideo(pendingLoad.id, pendingLoad.start); pendingLoad = null; }
          },
          onStateChange(e) {
            if (e.data === window.YT.PlayerState.PLAYING) { ytPlayer.setVolume(savedVol()); ytPlayer.unMute(); }
            if (_roundActive && _lastVideo && (e.data === window.YT.PlayerState.ENDED || e.data === window.YT.PlayerState.PAUSED)) {
              const elapsed = (Date.now() - _lastVideo.startedAt) / 1000;
              loadVideo(_lastVideo.videoId, _lastVideo.startSeconds + elapsed);
            }
          }
        }
      });
    };
    // Inject YouTube script
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });

  onDestroy(() => {
    if (socket) socket.disconnect();
    clearTimeout(feedTimer);
    clearInterval(countdownInterval);
  });
</script>

<svelte:head>
  <title>ZIK &mdash; En jeu</title>
  <link rel="stylesheet" href="/css/game.css">
</svelte:head>

{#if showDcBanner}
  <div id="dc-banner" style="display:block;position:fixed;top:0;left:0;right:0;z-index:9999;background:#b45309;color:#fff;text-align:center;padding:8px;font-size:.875rem;font-weight:600">
    Reconnexion en cours&hellip;
  </div>
{/if}

<audio id="previewAudio" style="display:none" preload="auto"></audio>
<div id="app">
  <!-- Timer bar -->
  <div id="timer-wrap">
    <div id="timer-bar" style="width:{timerPct}%;background:{timerColor};transition:width 1s linear,background .4s"></div>
  </div>

  <div id="game-screen">

    <!-- Header -->
    <header class="g-header">
      <a href="/" class="back">&larr; Rooms</a>
      <div class="header-mid">
        <div id="room-label" class="room-label">{roomLabel}</div>
        <div id="round-info" class="round-info">{roundInfo}</div>
      </div>
      <div class="vol-ctrl">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        <input type="range" id="volSlider" min="0" max="100" value={volValue} oninput={e => setVol(parseInt(e.target.value))}>
      </div>
    </header>

    <!-- Left: scoreboard -->
    <aside id="sidebar-left">
      <div class="side-title">Joueurs</div>
      <div id="player-list">
        {#each players as p, i (p.name)}
          <div class="p-card rank-{i+1}">
            <span class="p-name">{p.rank} {p.name}</span>
            <div class="p-right">
              <div class="p-badge {p.foundArtist ? 'f' : ''}">A</div>
              <div class="p-badge {p.foundTitle  ? 'f' : ''}">T</div>
              {#if p.foundFeats?.some(Boolean)}<div class="p-badge f">F</div>{/if}
              <span class="p-score{p.scored ? ' flash' : ''}">{p.score}pt</span>
            </div>
          </div>
        {/each}
      </div>
    </aside>

    <!-- Center -->
    <main id="center">

      <!-- Cover -->
      <div id="cover-wrap">
        {#if !showCover}
          <div id="cover-placeholder">
            <div class="vinyl"></div>
            <span class="vinyl-q">?</span>
          </div>
        {:else}
          <img id="cover-img" src={coverSrc} alt="Album cover" style="display:block">
        {/if}
      </div>

      <!-- Slots -->
      <div class="slots" id="slots-wrap">
        <div class="slot {slotArtist.state || ''}" id="slot-artist">
          <span class="slot-label">Artiste</span>
          <div class="slot-val">{slotArtist.val}</div>
        </div>
        {#each featSlots as fs, i}
          <div class="slot slot-feat {fs.state || ''}" id="slot-feat-{i}">
            <span class="slot-label">{featSlots.length > 1 ? `Feat. ${i+1}` : 'Feat.'}</span>
            <div class="slot-val">{fs.val}</div>
          </div>
        {/each}
        <div class="slot {slotTitle.state || ''}" id="slot-title">
          <span class="slot-label">Titre</span>
          <div class="slot-val">{slotTitle.val}</div>
        </div>
      </div>

      <!-- Feedback -->
      {#if feedback.msg}
        <div id="feedback" class="show {feedback.cls}">{feedback.msg}</div>
      {:else}
        <div id="feedback"></div>
      {/if}

      <!-- Round summary -->
      {#if summaryShow}
        <div id="round-summary" style="display:block">
          <p id="summary-reason">{summaryReason}</p>
          <p id="summary-finder">{summaryFinder}</p>
        </div>
      {/if}

      <!-- Error -->
      {#if errorMsg}
        <div id="error-msg" style="display:block">{errorMsg}</div>
      {/if}

      <!-- Start button / countdown / waiting info -->
      {#if showStart}
        {#if showCountdown}
          <div class="auto-countdown">
            <div class="countdown-circle">{countdownVal}</div>
            <p class="countdown-label">La partie d&eacute;marre automatiquement&hellip;</p>
          </div>
        {:else if hasOwner && autoStart && !isAdmin}
          <div class="info-waiting">&#x23F3; La partie va d&eacute;marrer automatiquement&hellip;</div>
        {:else if hasOwner && !autoStart && !isAdmin}
          <div class="info-waiting">
            &#x23F3; En attente de l&apos;administrateur&hellip;<br>
            <small>Seul le cr&eacute;ateur de cette room peut d&eacute;marrer la partie.</small>
          </div>
        {:else}
          <button id="startBtn" class="start-btn" onclick={requestGame} disabled={startDisabled}>
            {#if startLabel === 'Chargement\u2026'}Chargement&hellip;{:else}&#x1F3AE; Lancer la partie{/if}
          </button>
          {#if hasOwner && !autoStart}
            <p class="info-admin-hint">Tu es l&apos;admin &mdash; toi seul peux lancer la partie.</p>
          {/if}
        {/if}
      {/if}

    </main>

    <!-- Right: history -->
    <aside id="sidebar-right">
      <div class="side-title">Historique</div>
      <div id="history-list">
        {#each history as item (item.answer + item.round)}
          {@const _di = item.answer.indexOf(' - ')}
          {@const _ha = _di > -1 ? item.answer.slice(0, _di) : item.answer}
          {@const _ht = _di > -1 ? item.answer.slice(_di + 3) : '—'}
          <div class="h-item">
            {#if item.cover}
              <img src={item.cover} alt="">
            {:else}
              <div class="h-no-img">&#x266A;</div>
            {/if}
            <div class="h-info">
              <div class="h-artist" class:h-found={item.foundArtist}>{_ha}</div>
              {#if item.featArtists?.length}
                <div class="h-feats">
                  {#each item.featArtists as fa, fi}
                    <span class="h-feat" class:h-found={item.foundFeats?.[fi]}>feat. {fa}</span>
                  {/each}
                </div>
              {/if}
              <div class="h-title" class:h-found={item.foundTitle}>{_ht}</div>
            </div>
          </div>
        {/each}
      </div>
    </aside>

    <!-- Footer input -->
    <footer class="g-footer">
      <div class="guess-wrap">
        <input
          type="text"
          id="guessInput"
          placeholder="Artiste ou titre…"
          disabled={guessDisabled}
          bind:value={guessVal}
          autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="100"
          onkeydown={e => { if (e.key === 'Enter') submitGuess(); }}
        >
        <button id="submitBtn" class="guess-submit" disabled={guessDisabled} onclick={submitGuess} aria-label="Valider">&rarr;</button>
      </div>
    </footer>

  </div>

  <!-- Game Over -->
  {#if gameoverShow}
    <div id="gameover" style="display:flex">
      <div class="go-card">
        <div class="go-title">&#x1F3C1; Partie termin&eacute;e</div>
        <div id="go-scores">
          {#each gameoverScores as p, i}
            {@const medals = ['\u{1F947}','\u{1F948}','\u{1F949}']}
            <div class="go-row rank-{i+1}">
              <span class="go-medal">{medals[i] || `#${i+1}`}</span>
              <span class="go-name">{p.name}{#if p.isGuest}&nbsp;<span style="font-size:.7rem;opacity:.5">(invit&eacute;)</span>{/if}</span>
              <span class="go-score">{p.score} pts</span>
            </div>
          {/each}
        </div>
        <div class="go-actions">
          {#if !hasOwner || autoStart || isAdmin}
            <button class="start-btn" onclick={requestGame}>&#x1F504; Rejouer</button>
          {:else}
            <div class="info-waiting" style="font-size:.8rem">&#x23F3; En attente de l&apos;admin pour rejouer.</div>
          {/if}
          <a href="/" class="go-back">&larr; Changer de room</a>
        </div>
      </div>
    </div>
  {/if}

</div>

<!-- Hidden YouTube player -->
<div id="yt-player" style="position:fixed;bottom:-1px;left:-1px;width:1px;height:1px;overflow:hidden;pointer-events:none"></div>
