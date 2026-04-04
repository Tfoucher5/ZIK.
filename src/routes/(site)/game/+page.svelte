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
  let revealStep = $state(0);
  let _revealTimers = [];

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
      audio.play().catch(() => {
        // Autoplay blocked (focus on input, etc.) → retry on next user gesture
        const resume = () => {
          audio.play().catch(() => {});
          document.removeEventListener('pointerdown', resume, true);
          document.removeEventListener('keydown',     resume, true);
        };
        document.addEventListener('pointerdown', resume, true);
        document.addEventListener('keydown',     resume, true);
      });
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

  function launchConfetti() {
    if (!browser) return;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#fbbf24','#a855f7','#3b82f6','#10b981','#f43f5e','#06b6d4','#e879f9','#84cc16'];
    for (let i = 0; i < 130; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*1.8}s;animation-duration:${2.5+Math.random()*2.5}s;width:${5+Math.random()*7}px;height:${6+Math.random()*9}px;transform:rotate(${Math.random()*360}deg);border-radius:${Math.random()>0.5?'50%':'2px'};`;
      container.appendChild(el);
    }
    setTimeout(() => { if (container.parentNode) container.remove(); }, 7000);
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
      setTimeout(() => document.getElementById('guessInput')?.focus(), 50);
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
    socket.on('game_starting', () => { gameoverShow = false; showStart = false; stopCountdownUI(); revealStep = 0; _revealTimers.forEach(clearTimeout); _revealTimers = []; });
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
      revealStep = 0;
      _revealTimers.forEach(clearTimeout);
      _revealTimers = [];
      _revealTimers.push(setTimeout(() => { revealStep = 1; }, 600));
      _revealTimers.push(setTimeout(() => { revealStep = 2; }, 2100));
      _revealTimers.push(setTimeout(() => { revealStep = 3; launchConfetti(); }, 3900));
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
    _revealTimers.forEach(clearTimeout);
  });
</script>

<svelte:head>
  <title>ZIK — En jeu</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/game.css">
</svelte:head>

{#if showDcBanner}
  <div class="g-dc-banner">Reconnexion en cours&hellip;</div>
{/if}

<audio id="previewAudio" style="display:none" preload="auto"></audio>

<!-- Timer bar (fixed top) -->
<div class="g-timer"><div class="g-timer-fill" style="width:{timerPct}%;background:{timerColor}"></div></div>

<div class="g-app">

  <!-- Header -->
  <header class="g-header">
    <a href="/" class="g-back">&#x2190; Rooms</a>
    <div class="g-header-mid">
      <div class="g-room-name">{roomLabel}</div>
      <div class="g-round-info">{roundInfo}</div>
    </div>
    <div class="g-vol">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
      <input type="range" id="volSlider" min="0" max="100" value={volValue} oninput={e => setVol(parseInt(e.target.value))}>
    </div>
  </header>

  <!-- Corps principal -->
  <div class="g-body">

    <!-- Sidebar gauche : classement -->
    <aside class="g-sidebar g-sidebar-scores">
      <div class="g-sidebar-title">Classement</div>
      <div class="g-player-list" id="player-list">
        {#each players as p, i (p.name)}
          <div class="g-player rank-{i+1}">
            <span class="g-player-rank">{p.rank}</span>
            <span class="g-player-name">
              <a href="/user/{p.name}" class="g-player-link" onclick={e => e.stopPropagation()}>{p.name}</a>
            </span>
            <div class="g-badges">
              <span class="g-badge {p.foundArtist ? 'found' : ''}">A</span>
              <span class="g-badge {p.foundTitle ? 'found' : ''}">T</span>
              {#if p.foundFeats?.some(Boolean)}<span class="g-badge found">F</span>{/if}
            </div>
            <span class="g-player-score {p.scored ? 'flash' : ''}">{p.score}<small>pt</small></span>
          </div>
        {/each}
      </div>
    </aside>

    <!-- Colonne centrale -->
    <div class="g-col-center">
      <main class="g-center">

        <!-- Pochette -->
        <div class="g-cover-wrap">
          {#if !showCover}
            <div class="g-cover-placeholder">
              <div class="vinyl"></div>
              <span class="vinyl-q">?</span>
            </div>
          {:else}
            <img class="g-cover-img" src={coverSrc} alt="Pochette">
          {/if}
        </div>

        <!-- Slots artiste / titre -->
        <div class="g-slots">
          <div class="g-slot {slotArtist.state || ''}">
            <span class="g-slot-label">Artiste</span>
            <div class="g-slot-val">{slotArtist.val}</div>
          </div>
          {#each featSlots as fs, i}
            <div class="g-slot g-slot-feat {fs.state || ''}">
              <span class="g-slot-label">{featSlots.length > 1 ? `Feat. ${i+1}` : 'Feat.'}</span>
              <div class="g-slot-val">{fs.val}</div>
            </div>
          {/each}
          <div class="g-slot {slotTitle.state || ''}">
            <span class="g-slot-label">Titre</span>
            <div class="g-slot-val">{slotTitle.val}</div>
          </div>
        </div>

        <!-- Feedback toast -->
        <div class="g-feedback {feedback.msg ? 'show ' + feedback.cls : ''}">{feedback.msg}</div>

        <!-- Round summary (desktop inline, mobile overlay géré séparément) -->
        {#if summaryShow}
          <div class="g-summary g-summary-desktop">
            <p class="g-summary-reason">{summaryReason}</p>
            <p class="g-summary-finder">{summaryFinder}</p>
          </div>
        {/if}

        <!-- Erreur -->
        {#if errorMsg}
          <div class="g-error">{errorMsg}</div>
        {/if}

        <!-- Start / countdown / attente -->
        {#if showStart}
          {#if showCountdown}
            <div class="g-countdown">
              <div class="g-countdown-circle">{countdownVal}</div>
              <p class="g-countdown-label">La partie d&eacute;marre&hellip;</p>
            </div>
          {:else if hasOwner && autoStart && !isAdmin}
            <div class="g-waiting">&#x23F3; La partie va d&eacute;marrer automatiquement&hellip;</div>
          {:else if hasOwner && !autoStart && !isAdmin}
            <div class="g-waiting">
              &#x23F3; En attente de l&apos;administrateur&hellip;<br>
              <small>Seul le cr&eacute;ateur peut lancer la partie.</small>
            </div>
          {:else}
            <button class="g-start-btn" onclick={requestGame} disabled={startDisabled}>
              {#if startLabel === 'Chargement\u2026'}Chargement&hellip;{:else}&#x1F3AE; Lancer la partie{/if}
            </button>
            {#if hasOwner && !autoStart}
              <p class="g-admin-hint">Tu es l&apos;admin &mdash; toi seul peux lancer.</p>
            {/if}
          {/if}
        {/if}

      </main>

      <!-- Input bar (dans la colonne centrale) -->
      <div class="g-input-bar">
        <div class="g-input-wrap">
          <input
            type="text"
            id="guessInput"
            class="g-input"
            placeholder="Artiste ou titre&hellip;"
            disabled={guessDisabled}
            bind:value={guessVal}
            autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="100"
            onkeydown={e => { if (e.key === 'Enter') submitGuess(); }}
          >
          <button class="g-submit-btn" disabled={guessDisabled} onclick={submitGuess} aria-label="Valider">&#x2192;</button>
        </div>
      </div>
    </div>

    <!-- Sidebar droite : historique -->
    <aside class="g-sidebar g-sidebar-history">
      <div class="g-sidebar-title">Historique</div>
      <div class="g-history-list" id="history-list">
        {#each history as item (item.answer + item.round)}
          {@const _di = item.answer.indexOf(' - ')}
          {@const _ha = _di > -1 ? item.answer.slice(0, _di) : item.answer}
          {@const _ht = _di > -1 ? item.answer.slice(_di + 3) : '—'}
          <div class="g-hitem">
            {#if item.cover}
              <img src={item.cover} alt="" class="g-hitem-img">
            {:else}
              <div class="g-hitem-img g-hitem-noimg">&#x266A;</div>
            {/if}
            <div class="g-hitem-info">
              <div class="g-hitem-artist" class:found={item.foundArtist}>{_ha}</div>
              {#if item.featArtists?.length}
                {#each item.featArtists as fa, fi}
                  <div class="g-hitem-feat" class:found={item.foundFeats?.[fi]}>feat. {fa}</div>
                {/each}
              {/if}
              <div class="g-hitem-title" class:found={item.foundTitle}>{_ht}</div>
            </div>
          </div>
        {/each}
      </div>
    </aside>

  </div>

</div>

<!-- Round summary MOBILE (overlay fixe au dessus de l'input) -->
{#if summaryShow}
  <div class="g-summary-mobile">
    <p class="g-summary-reason">{summaryReason}</p>
    <p class="g-summary-finder">{summaryFinder}</p>
  </div>
{/if}

<!-- Game Over -->
{#if gameoverShow}
  <div class="g-gameover">
    <div class="g-go-card">
      <div class="g-go-title">&#x1F3C6; Classement Final</div>

      <div class="g-go-podium">
        <!-- 2e -->
        <div class="g-podium-slot pos-2">
          {#if gameoverScores[1]}
            <div class="g-podium-player" class:revealed={revealStep >= 2}>
              <div class="g-podium-avatar">{gameoverScores[1].name[0]?.toUpperCase() ?? '?'}</div>
              <div class="g-podium-name">{gameoverScores[1].name}</div>
              <div class="g-podium-score">{gameoverScores[1].score}&nbsp;pts</div>
            </div>
          {:else}
            <div class="g-podium-player g-podium-empty revealed"><div class="g-podium-avatar empty">?</div><div class="g-podium-name">&mdash;</div></div>
          {/if}
          <div class="g-podium-block pos-2">&#x1F948;</div>
        </div>
        <!-- 1er -->
        <div class="g-podium-slot pos-1">
          {#if gameoverScores[0]}
            <div class="g-podium-player" class:revealed={revealStep >= 3}>
              <div class="g-podium-avatar gold">{gameoverScores[0].name[0]?.toUpperCase() ?? '?'}</div>
              <div class="g-podium-name">{gameoverScores[0].name}</div>
              <div class="g-podium-score">{gameoverScores[0].score}&nbsp;pts</div>
            </div>
          {:else}
            <div class="g-podium-player g-podium-empty revealed"><div class="g-podium-avatar empty">?</div><div class="g-podium-name">&mdash;</div></div>
          {/if}
          <div class="g-podium-block pos-1">&#x1F947;</div>
        </div>
        <!-- 3e -->
        <div class="g-podium-slot pos-3">
          {#if gameoverScores[2]}
            <div class="g-podium-player" class:revealed={revealStep >= 1}>
              <div class="g-podium-avatar">{gameoverScores[2].name[0]?.toUpperCase() ?? '?'}</div>
              <div class="g-podium-name">{gameoverScores[2].name}</div>
              <div class="g-podium-score">{gameoverScores[2].score}&nbsp;pts</div>
            </div>
          {:else}
            <div class="g-podium-player g-podium-empty revealed"><div class="g-podium-avatar empty">?</div><div class="g-podium-name">&mdash;</div></div>
          {/if}
          <div class="g-podium-block pos-3">&#x1F949;</div>
        </div>
      </div>

      {#if gameoverScores.length > 3}
        <div class="g-go-rest">
          {#each gameoverScores.slice(3) as p, i}
            <div class="g-go-row">
              <span class="g-go-medal">#{i + 4}</span>
              <span class="g-go-name">{#if p.isGuest}{p.name}&nbsp;<span class="g-go-guest">(invit&eacute;)</span>{:else}<a href="/user/{p.name}" class="g-go-link">{p.name}</a>{/if}</span>
              <span class="g-go-score">{p.score}&nbsp;pts</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="g-go-actions">
        {#if !hasOwner || autoStart || isAdmin}
          <button class="g-start-btn" onclick={requestGame}>&#x1F504; Rejouer</button>
        {:else}
          <div class="g-waiting" style="font-size:.8rem">&#x23F3; En attente de l&apos;admin pour rejouer.</div>
        {/if}
        <a href="/" class="g-go-back">&#x2190; Changer de room</a>
      </div>
    </div>
  </div>
{/if}

<!-- Hidden YouTube player -->
<div id="yt-player" style="position:fixed;bottom:-1px;left:-1px;width:1px;height:1px;overflow:hidden;pointer-events:none"></div>
