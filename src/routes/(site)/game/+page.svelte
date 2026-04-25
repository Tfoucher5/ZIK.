<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ReportModal from '$lib/components/ReportModal.svelte';

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
  let extraSlots  = $state([]);
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
  let adminLocked   = $state(false);
  let adminAnnounceMsg = $state('');
  let _announceTimer = null;
  let gameoverShow = $state(false);
  let gameoverScores = $state([]);
  let guessVal    = $state('');
  let guessDisabled = $state(true);
  let gameMode    = $state('classic');
  let qcmChoices       = $state([]);
  let qcmChosen        = $state(null);
  let qcmReveal        = $state(null);
  let qcmChoiceResult  = $state(null);   // { correct, pts } after submitting
  let qcmAnsweredCount = $state(0);
  let qcmTotalPlayers  = $state(0);
  let showDcBanner = $state(false);
  let volValue    = $state(50);

  // Signalement
  let reportOpen     = $state(false);
  let reportType     = $state('user');
  let reportUsername = $state('');
  let reportUserId   = $state(null);
  let openMenuFor    = $state(null); // nom du joueur dont le dropdown est ouvert

  function openUserReport(p) {
    reportType     = 'user';
    reportUsername = p.name;
    reportUserId   = p.userId || null;
    reportOpen     = true;
    openMenuFor    = null;
  }
  function openBugReport() {
    reportType = 'bug';
    reportOpen = true;
  }
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
  let syncWaiting  = $state(false);
  let syncReady    = $state(0);
  let syncTotal    = $state(0);
  let roundLoading = $state(false);
  let _roundLoadingTimer = null;
  let _waitingForSync = false;
  let _syncPaused    = false;
  let _adminPaused   = false;
  let _usingIframe   = false;
  let _metaGuardInterval = null;

  // Chat
  let chatOpen     = $state(false);
  let chatMessages = $state([]);
  let chatInput    = $state('');
  let chatUnread   = $state(0);
  let chatEl       = null;

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

  function _createYTPlayer() {
    window.onYouTubeIframeAPIReady = () => {
      ytPlayer = new window.YT.Player('yt-player', {
        height: '1', width: '1',
        playerVars: { autoplay: 1, controls: 0, enablejsapi: 1, playsinline: 1 },
        events: {
          onReady(e) {
            ytReady = true;
            e.target.setVolume(savedVol());
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
              document.addEventListener('touchstart', function iosUnlock() {
                document.removeEventListener('touchstart', iosUnlock, true);
                ytPlayer.mute();
                ytPlayer.playVideo();
                setTimeout(() => { if (!_roundActive) ytPlayer.pauseVideo(); }, 200);
              }, { capture: true, once: true });
            }
            if (pendingLoad) { loadVideo(pendingLoad.id, pendingLoad.start); pendingLoad = null; }
          },
          onStateChange(e) {
            if (e.data === window.YT.PlayerState.PLAYING) {
              ytPlayer.setVolume(savedVol());
              ytPlayer.unMute();
              startMediaGuard();
              if (_waitingForSync && socket) {
                socket.emit('player_ready');
                _syncPaused = true;
                ytPlayer.pauseVideo();
              }
            }
            if (!_syncPaused && !_adminPaused && _roundActive && _lastVideo && (e.data === window.YT.PlayerState.ENDED || e.data === window.YT.PlayerState.PAUSED)) {
              const elapsed = (Date.now() - _lastVideo.startedAt) / 1000;
              loadVideo(_lastVideo.videoId, _lastVideo.startSeconds + elapsed);
            }
          }
        }
      });
    };
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    } else if (window.YT?.Player) {
      window.onYouTubeIframeAPIReady();
    }
  }

  function loadVideo(videoId, startSeconds) {
    if (!ytReady || !ytPlayer) {
      pendingLoad = { id: videoId, start: startSeconds };
      _createYTPlayer();
      return;
    }
    ytPlayer.mute();
    ytPlayer.loadVideoById({ videoId, startSeconds });
  }
  const _FAKE_META = { title: '♪ ♪ ♪', artist: '???', album: 'ZIK — Blind Test', artwork: [{ src: '/favicon/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' }] };

  function lockMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      const fake = new MediaMetadata(_FAKE_META);
      Object.defineProperty(navigator.mediaSession, 'metadata', {
        get: () => fake,
        set: () => {},
        configurable: true,
      });
    } catch {}
    navigator.mediaSession.playbackState = 'playing';
  }

  function startMediaGuard() {
    lockMediaSession();
    clearInterval(_metaGuardInterval);
    _metaGuardInterval = setInterval(lockMediaSession, 200);
  }

  function stopMediaGuard() {
    clearInterval(_metaGuardInterval);
    _metaGuardInterval = null;
    try {
      Object.defineProperty(navigator.mediaSession, 'metadata', {
        get: () => null,
        set: (v) => {},
        configurable: true,
      });
    } catch {}
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function loadAudio(audioUrl, startSeconds) {
    const audio = document.getElementById('previewAudio');
    if (!audio) return;
    if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
    audio.pause();
    audio.onloadedmetadata = null;
    audio.onended = null;
    startMediaGuard();
    audio.src = audioUrl;
    audio.volume = savedVol() / 100;
    audio.onloadedmetadata = () => {
      audio.currentTime = startSeconds;
      audio.play().catch(() => {
        const resume = () => {
          audio.play().catch(() => {});
          document.removeEventListener('pointerdown', resume, true);
          document.removeEventListener('keydown',     resume, true);
        };
        document.addEventListener('pointerdown', resume, true);
        document.addEventListener('keydown',     resume, true);
      });
    };
    audio.onended = () => {
      if (_roundActive) { audio.currentTime = 0; audio.play().catch(() => {}); }
    };
    audio.load();
  }

  function loadPreview(previewUrl) {
    const audio = document.getElementById('previewAudio');
    if (!audio) return;
    if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
    audio.pause();
    audio.onloadedmetadata = null;
    startMediaGuard();
    audio.src = previewUrl;
    audio.volume = savedVol() / 100;
    audio.onloadedmetadata = () => {
      const maxSeek = Math.max(0, Math.min((audio.duration || 30) - 10, 20));
      audio.currentTime = Math.random() * maxSeek;
      audio.play().catch(() => {
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

  function stopVideo() {
    if (ytReady && ytPlayer) ytPlayer.stopVideo();
    const audio = document.getElementById('previewAudio');
    if (audio) { audio.onended = null; audio.pause(); audio.src = ''; }
  }

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
      tick().then(() => document.getElementById('guessInput')?.focus());
    }
  }

  function submitChoice(index) {
    if (qcmChosen !== null || guessDisabled || !socket) return;
    qcmChosen = index;
    socket.emit('submit_choice', { choiceIndex: index });
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text || !socket) return;
    socket.emit('send_chat', text);
    chatInput = '';
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    if (chatOpen) {
      chatUnread = 0;
      tick().then(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; });
    }
  }

  onMount(async () => {
    lockMediaSession();
    const P  = new URLSearchParams(location.search);
    ROOM_ID  = P.get('roomId')   || 'pop';
    USERNAME = P.get('username') || sessionStorage.getItem('zik_uname') || 'Joueur';
    USER_ID  = P.get('userId')   || sessionStorage.getItem('zik_uid')   || null;
    IS_GUEST = P.get('isGuest') === '1' || !USER_ID;
    gameMode = P.get('gameMode') || 'classic';

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
        autoStart   = roomConfig.autoStart    || false;
        isAdmin     = roomConfig.isAdmin      || false;
        hasOwner    = roomConfig.hasOwner     || false;
        adminLocked = roomConfig.adminBlocked || false;
        if (adminLocked) startDisabled = true;
        if (roomConfig.gameMode) gameMode = roomConfig.gameMode;
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
    socket.on('game_starting', () => { gameoverShow = false; showStart = false; stopCountdownUI(); revealStep = 0; _revealTimers.forEach(clearTimeout); _revealTimers = []; clearTimeout(_roundLoadingTimer); roundLoading = false; });
    socket.on('round_loading', () => {
      clearTimeout(_roundLoadingTimer);
      _roundLoadingTimer = setTimeout(() => { roundLoading = true; }, 1500);
    });
    socket.on('start_round', data => {
      clearTimeout(_roundLoadingTimer);
      roundLoading = false;
      roundInfo = `Manche ${data.round} / ${data.total}`;
      coverSrc = ''; showCover = false;
      summaryShow = false; gameoverShow = false; feedback = { msg: '', cls: '' };
      const featCount = data.featCount || 0;
      featSlots  = Array.from({ length: featCount }, () => ({ val: '???', state: null }));
      extraSlots = (data.extraLabels || []).map(label => ({ val: '???', state: null, label }));
      slotArtist = { val: '???', state: null };
      slotTitle  = { val: '???', state: null };
      timerPct = 100; timerColor = 'var(--accent)';
      guessDisabled = true; guessVal = '';
      qcmChoices = data.choices || [];
      qcmChosen = null;
      qcmReveal = null;
      qcmChoiceResult = null;
      qcmAnsweredCount = 0;
      qcmTotalPlayers = 0;
      showStart = false; startDisabled = false; startLabel = '\u{1F3AE} Lancer la partie';
      _roundActive = true;
      _waitingForSync = true;
      syncWaiting = true;
      syncReady = 0; syncTotal = 0;
      _lastVideo = { videoId: data.videoId, startSeconds: data.startSeconds, startedAt: Date.now() };
      if (data.audioUrl) {
        _usingIframe = false;
        loadAudio(data.audioUrl, data.startSeconds);
        if (socket) socket.emit('player_ready');
      } else {
        _usingIframe = true;
        loadVideo(data.videoId, data.startSeconds);
      }
    });
    socket.on('round_start_sync', () => {
      _waitingForSync = false;
      syncWaiting = false;
      guessDisabled = false;
      _syncPaused = false;
      if (_usingIframe) {
        if (ytPlayer?.unMute) ytPlayer.unMute();
        if (ytPlayer?.setVolume) ytPlayer.setVolume(savedVol());
        if (ytPlayer?.playVideo) ytPlayer.playVideo();
      }
      tick().then(() => document.getElementById('guessInput')?.focus());
    });
    socket.on('ready_update', ({ ready, total }) => {
      syncReady = ready;
      syncTotal = total;
    });
    socket.on('chat_history', msgs => { chatMessages = msgs; });
    socket.on('chat_message', msg => {
      chatMessages = [...chatMessages, msg];
      if (!chatOpen) chatUnread++;
      tick().then(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; });
    });
    socket.on('timer_update', ({ current, max }) => {
      timerPct = (current / max) * 100;
      timerColor = timerPct < 30 ? 'var(--danger)' : timerPct < 60 ? '#f59e0b' : 'var(--accent)';
    });
    socket.on('feedback', data => {
      if (data.type === 'success_artist') slotArtist = { val: data.val, state: 'found' };
      if (data.type === 'success_feat') { const fi = data.featIndex ?? 0; featSlots = featSlots.map((s, i) => i === fi ? { val: data.val, state: 'found' } : s); }
      if (data.type === 'success_title') slotTitle = { val: data.val, state: 'found' };
      if (data.type === 'success_extra') { const ei = data.extraIndex ?? 0; extraSlots = extraSlots.map((s, i) => i === ei ? { ...s, val: data.val, state: 'found' } : s); }
      const cls = data.type === 'miss' ? 'cold' : data.type === 'close' ? 'hot' : 'good';
      showFeedback(data.msg, cls);
    });
    socket.on('reveal_cover', ({ cover }) => { if (cover) { coverSrc = cover; showCover = true; } });
    socket.on('qcm_reveal', ({ correctChoiceIndex }) => {
      qcmReveal = correctChoiceIndex;
      const correct = qcmChoices[correctChoiceIndex];
      if (correct) {
        const sep = correct.indexOf(' — ');
        const won = qcmChosen === correctChoiceIndex;
        slotArtist = { val: sep > -1 ? correct.slice(0, sep) : correct, state: won ? 'found' : 'missed' };
        slotTitle  = { val: sep > -1 ? correct.slice(sep + 3) : '—', state: won ? 'found' : 'missed' };
      }
    });
    socket.on('choice_result', (result) => {
      qcmChoiceResult = result;
    });
    socket.on('qcm_answered_update', ({ answered, total }) => {
      qcmAnsweredCount = answered;
      qcmTotalPlayers = total;
    });

    socket.on('round_end', data => {
      if (gameMode === 'qcm' && data.correctChoiceIndex !== undefined) {
        qcmReveal = data.correctChoiceIndex;
      }
      const dashIdx    = data.answer.indexOf(' - ');
      const fullArtist = dashIdx > -1 ? data.answer.slice(0, dashIdx) : data.answer;
      const title      = dashIdx > -1 ? data.answer.slice(dashIdx + 3) : '\u2014';
      const feats      = data.featArtists || [];
      const mainArtist = feats.length ? parseFeat(fullArtist).main : fullArtist;
      slotArtist = { val: mainArtist, state: data.foundArtist ? 'found' : 'missed' };
      featSlots  = feats.map((fa, i) => ({ val: fa, state: (data.foundFeats || [])[i] ? 'found' : 'missed' }));
      slotTitle  = { val: title || '\u2014', state: data.foundTitle ? 'found' : 'missed' };
      extraSlots = (data.extraAnswers || []).map((e, i) => ({ label: e.label, val: e.value, state: (data.foundExtras || [])[i] ? 'found' : 'missed' }));
      if (data.cover) { coverSrc = data.cover; showCover = true; }
      summaryShow = true;
      summaryReason = data.reason;
      summaryFinder = data.totalFound > 0 ? `\u{1F3C6} 1er : ${data.firstFinder} \u2014 ${data.totalFound} joueur(s) ont tout trouv\u00e9` : '\u274C Personne n\u2019a trouv\u00e9';
      _roundActive = false; _waitingForSync = false; syncWaiting = false; guessDisabled = true; stopVideo(); timerPct = 0;
      stopMediaGuard();
      history = [data, ...history];
    });
    socket.on('game_over', scores => {
      _roundActive = false; stopVideo();
      stopMediaGuard();
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

    socket.on('admin_kicked', () => {
      socket.disconnect();
      goto('/rooms');
    });

    socket.on('admin_pause', () => {
      _adminPaused = true;
      try { ytPlayer?.pauseVideo(); } catch { /* ignore */ }
      const _a = document.getElementById('previewAudio');
      if (_a) _a.pause();
    });

    socket.on('admin_resume', () => {
      _adminPaused = false;
      try { ytPlayer?.playVideo(); } catch { /* ignore */ }
      const _a = document.getElementById('previewAudio');
      if (_a) _a.play().catch(() => {});
    });

    socket.on('admin_announce', ({ message }) => {
      clearTimeout(_announceTimer);
      adminAnnounceMsg = message;
      _announceTimer = setTimeout(() => { adminAnnounceMsg = ''; }, 8000);
    });

    socket.on('admin_blocked', () => {
      adminLocked = true;
      startDisabled = true;
    });

    socket.on('admin_unblocked', () => {
      adminLocked = false;
      startDisabled = false;
    });

    // Join
    _hasJoined = true;
    socket.emit('join_room', { roomId: ROOM_ID, username: USERNAME, userId: USER_ID, isGuest: IS_GUEST });

  });

  onDestroy(() => {
    if (socket) socket.disconnect();
    stopMediaGuard();
    clearTimeout(feedTimer);
    clearTimeout(_roundLoadingTimer);
    clearInterval(countdownInterval);
    _revealTimers.forEach(clearTimeout);
  });
</script>

<svelte:head>
  <title>ZIK — En jeu</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/game.css?v=2.1.1">
</svelte:head>

{#if showDcBanner}
  <div class="g-dc-banner">Reconnexion en cours&hellip;</div>
{/if}

<audio id="previewAudio" style="display:none" preload="auto"></audio>

<!-- Timer bar (fixed top) -->
<div class="g-timer"><div class="g-timer-fill" style="width:{timerPct}%;background:{timerColor}"></div></div>

{#if adminAnnounceMsg}
  <div class="g-admin-announce" role="alert">
    <span class="g-announce-icon">📢</span>
    <span class="g-announce-text">{adminAnnounceMsg}</span>
  </div>
{/if}

<div class="g-app">

  <!-- Header -->
  <header class="g-header">
    <a href="/" class="g-back">&#x2190; Rooms</a>
    <div class="g-header-mid">
      <div class="g-room-name">{roomLabel}</div>
      <div class="g-round-info">{roundInfo}</div>
    </div>
    <div class="g-header-right">
      <button class="g-chat-toggle" onclick={toggleChat} title="Chat" class:g-chat-active={chatOpen}>
        &#x1F4AC;
        {#if chatUnread > 0}<span class="g-chat-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>{/if}
      </button>
      <button class="g-bug-btn" onclick={openBugReport} title="Signaler un bug">🐛</button>
      <div class="g-vol">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        <input type="range" id="volSlider" min="0" max="100" value={volValue} oninput={e => setVol(parseInt(e.target.value))}>
      </div>
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
            {#if p.name !== USERNAME}
              <div class="g-player-menu">
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
                <span class="g-menu-dot" role="button" tabindex="0" onclick={e => { e.stopPropagation(); openMenuFor = openMenuFor === p.name ? null : p.name; }}>⋯</span>
                {#if openMenuFor === p.name}
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <div class="g-dropdown" role="menu" tabindex="-1" onclick={e => e.stopPropagation()}>
                    <button class="g-dd-item" onclick={() => openUserReport(p)}>🚨 Signaler ce joueur</button>
                  </div>
                {/if}
              </div>
            {/if}
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
          {#if gameMode !== 'qcm'}
            {#each featSlots as fs, i}
              <div class="g-slot g-slot-feat {fs.state || ''}">
                <span class="g-slot-label">{featSlots.length > 1 ? `Feat. ${i+1}` : 'Feat.'}</span>
                <div class="g-slot-val">{fs.val}</div>
              </div>
            {/each}
            {#each extraSlots as es}
              <div class="g-slot {es.state || ''}">
                <span class="g-slot-label">{es.label}</span>
                <div class="g-slot-val">{es.val}</div>
              </div>
            {/each}
          {/if}
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

        <!-- Chargement imprévu (yt-dlp lent, prefetch KO) -->
        {#if roundLoading}
          <div class="g-waiting">&#x23F3; Chargement de la prochaine manche&hellip;</div>
        {/if}

        <!-- Erreur -->
        {#if errorMsg}
          <div class="g-error">{errorMsg}</div>
        {/if}

        <!-- Start / countdown / attente -->
        {#if adminLocked}
          <div class="g-admin-lock">
            🔒 Cette room est verrouillée par un administrateur.<br>
            <small>Le lancement de partie est temporairement désactivé.</small>
          </div>
        {/if}
        {#if showStart && !adminLocked}
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

      <div class="g-input-bar" class:g-input-bar-qcm={gameMode === 'qcm' && qcmChoices.length > 0}>
        {#if syncWaiting}
          <div class="g-sync-waiting">
            &#x23F3; Chargement de la musique&hellip;
            {#if syncTotal > 1}<span class="g-sync-count">{syncReady}/{syncTotal}</span>{/if}
          </div>
        {/if}
        {#if gameMode === 'qcm' && qcmChoices.length > 0}
          <div class="g-qcm-grid">
            {#each qcmChoices as choice, i}
              {@const isChosen = qcmChosen === i}
              {@const isRevealing = qcmReveal !== null}
              {@const isCorrect = isRevealing && i === qcmReveal}
              {@const isWrong = isRevealing && isChosen && !isCorrect}
              {@const isNeutral = isRevealing && !isChosen && !isCorrect}
              <button
                class="g-qcm-btn g-qcm-{i}"
                class:g-qcm-selected={isChosen && !isRevealing}
                class:g-qcm-correct={isCorrect}
                class:g-qcm-wrong={isWrong}
                class:g-qcm-neutral={isNeutral}
                onclick={() => submitChoice(i)}
                disabled={guessDisabled || qcmChosen !== null}
              >
                <span class="g-qcm-shape"></span>
                <span class="g-qcm-text">{choice}</span>
              </button>
            {/each}
          </div>
          <div class="g-qcm-status-bar">
            {#if qcmChosen !== null && qcmChoiceResult !== null}
              {#if qcmChoiceResult.correct}
                <span class="g-qcm-pts-correct">+{qcmChoiceResult.pts} pts ✓</span>
              {:else}
                <span class="g-qcm-pts-wrong">+0 pt ✗</span>
              {/if}
            {:else if qcmChosen !== null}
              <span class="g-qcm-locked">Réponse verrouillée…</span>
            {:else if qcmReveal === null}
              <span class="g-qcm-hint">Choisis ta réponse !</span>
            {/if}
            {#if qcmReveal === null && qcmTotalPlayers > 1}
              <span class="g-qcm-count">{qcmAnsweredCount}/{qcmTotalPlayers} répondu{qcmAnsweredCount > 1 ? 's' : ''}</span>
            {/if}
          </div>
        {:else if gameMode !== 'qcm'}
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
        {/if}
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

<!-- Chat -->
{#if chatOpen}
  <div class="g-chat-panel">
    <div class="g-chat-head">
      <span>&#x1F4AC; Chat</span>
      <button class="g-chat-close" onclick={toggleChat}>&#x2715;</button>
    </div>
    <div class="g-chat-msgs" bind:this={chatEl}>
      {#if chatMessages.length === 0}
        <div class="g-chat-empty">Aucun message pour l&apos;instant&hellip;</div>
      {/if}
      {#each chatMessages as m (m.ts + m.name)}
        <div class="g-chat-msg" class:g-chat-mine={m.name === USERNAME} class:g-chat-admin={m.name.endsWith(' - admin')}>
          <span class="g-chat-author">{m.name}</span>
          <span class="g-chat-text">{m.text}</span>
        </div>
      {/each}
    </div>
    <div class="g-chat-input-row">
      <input
        class="g-chat-input"
        type="text"
        placeholder="Message&hellip;"
        maxlength="120"
        bind:value={chatInput}
        autocomplete="off" autocorrect="off" spellcheck="false"
        onkeydown={e => { if (e.key === 'Enter') sendChat(); }}
      >
      <button class="g-chat-send" onclick={sendChat}>&#x2192;</button>
    </div>
  </div>
{/if}

<!-- Signalement joueur / bug -->
<ReportModal
  bind:open={reportOpen}
  type={reportType}
  reportedUsername={reportUsername}
  reportedUserId={reportUserId}
  roomId={ROOM_ID}
  reporterId={USER_ID}
  reporterName={USERNAME}
/>

<!-- Fermeture dropdown au clic extérieur -->
{#if openMenuFor}
  <div aria-hidden="true" style="position:fixed;inset:0;z-index:98" onclick={() => { openMenuFor = null; }}></div>
{/if}

<!-- Hidden YouTube player -->
<div id="yt-player" style="position:fixed;bottom:-1px;left:-1px;width:1px;height:1px;overflow:hidden;pointer-events:none"></div>
