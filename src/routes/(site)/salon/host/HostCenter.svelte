<script>
  import { onMount, onDestroy } from 'svelte';

  let {
    phase = 'lobby', code = '', timerVal = 0, timerMax = 30,
    currentPhrase = '', players = [],
    roundEnd = null, finalScores = [],
    round = 0, total = 10,
    choices = null, answerMode = 'free',
    onRestart, onNewSalon, onMusicReady,
  } = $props();

  const medals = ['🥇', '🥈', '🥉'];
  const VIS_BARS = Array.from({ length: 18 }, (_, i) => i);

  // ─── Podium reveal ─────────────────────────────────────────────────────────
  let revealStep = $state(0);
  let _revealTimers = [];

  $effect(() => {
    if (phase === 'gameover') {
      revealStep = 0;
      _revealTimers.forEach(clearTimeout);
      _revealTimers = [];
      _revealTimers.push(setTimeout(() => { revealStep = 1; }, 600));
      _revealTimers.push(setTimeout(() => { revealStep = 2; }, 2100));
      _revealTimers.push(setTimeout(() => { revealStep = 3; launchConfetti(); }, 3900));
    } else {
      _revealTimers.forEach(clearTimeout);
      _revealTimers = [];
      revealStep = 0;
    }
  });

  function launchConfetti() {
    if (typeof document === 'undefined') return;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#fbbf24','#a855f7','#3b82f6','#10b981','#f43f5e','#06b6d4','#e879f9','#84cc16'];
    for (let i = 0; i < 160; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*2}s;animation-duration:${2.5+Math.random()*3}s;width:${5+Math.random()*8}px;height:${6+Math.random()*10}px;transform:rotate(${Math.random()*360}deg);border-radius:${Math.random()>0.5?'50%':'2px'};`;
      container.appendChild(el);
    }
    setTimeout(() => { if (container.parentNode) container.remove(); }, 8000);
  }

  // ─── YouTube ───────────────────────────────────────────────────────────────
  let ytReady = false;
  let ytPlayer;
  let currentStartSecs = 0;

  function initYT() {
    if (window.YT?.Player) { ytReady = true; return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { ytReady = true; };
  }

  export function loadVideo(videoId, startSeconds) {
    currentStartSecs = startSeconds;
    if (ytReady && ytPlayer) {
      ytPlayer.loadVideoById({ videoId, startSeconds, suggestedQuality: 'medium' });
      setTimeout(() => { try { ytPlayer.playVideo(); } catch { /* YT not ready */ } }, 400);
    } else {
      const check = setInterval(() => {
        if (!ytReady) return;
        clearInterval(check);
        ytPlayer = new window.YT.Player('salon-yt-player', {
          height: '100%', width: '100%', videoId,
          playerVars: { autoplay: 1, controls: 1, enablejsapi: 1, start: startSeconds, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => e.target.playVideo(),
            onStateChange: (e) => {
              if (e.data === 1 /* PLAYING */) {
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.metadata = new MediaMetadata({ title: '♪ ♪ ♪', artist: '???', album: 'ZIK — Blind Test' });
                  navigator.mediaSession.playbackState = 'playing';
                }
                onMusicReady?.();
              }
            },
          },
        });
      }, 200);
    }
  }

  export function revealVideo() {
    if (!ytPlayer) return;
    try { ytPlayer.seekTo(currentStartSecs, true); ytPlayer.playVideo(); } catch { /* YT not ready */ }
  }

  function timerPct() { return timerMax ? Math.max(0, (timerVal / timerMax) * 100) : 100; }

  function qrUrl(size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent('https://www.zik-music.fr/salon/play?code=' + code)}&bgcolor=ffffff&color=000000`;
  }

  onMount(initYT);
  onDestroy(() => { if (ytPlayer?.destroy) ytPlayer.destroy(); _revealTimers.forEach(clearTimeout); });
</script>

<div class="salon-host-center" class:phase-summary={phase === 'summary' || phase === 'gameover'}>

  <!-- Stage: 3 overlapping absolute panels -->
  <div class="salon-host-stage">

    <!-- Lobby panel -->
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

    <!-- Round panel -->
    <div class="salon-panel" class:active={phase === 'round'}>
      <div class="salon-round-stage">
        <div class="salon-big-timer {timerPct() < 20 ? 'danger' : timerPct() < 40 ? 'warn' : 'ok'}">{timerVal}</div>
        <div class="salon-phrase">{currentPhrase}</div>
        <div class="salon-visualizer">
          {#each VIS_BARS as i (i)}<div class="salon-vis-bar"></div>{/each}
        </div>
        {#if players.some(p => p.foundThisRound)}
          <div class="salon-finders">
            {#each players.filter(p => p.foundThisRound) as p (p.username)}
              <span class="salon-finder-chip">✓ {p.username}</span>
            {/each}
          </div>
        {/if}

        {#if answerMode === 'multiple' && choices && timerVal > 0}
          <div class="salon-choices salon-host-choices">
            {#each choices as choice, i (i)}
              <div class="salon-choice-btn c{i}">
                <span class="choice-shape"></span>
                <span class="choice-text">{choice}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Video panel: ALWAYS in DOM so YT iframe stays alive between rounds -->
    <div class="salon-panel" class:active={phase === 'summary' || phase === 'gameover'}>
      <div id="salon-yt-player"></div>
    </div>

  </div>

  <!-- Info area below stage -->
  <div class="salon-host-info">

    {#if phase === 'summary' && roundEnd}
      <div class="salon-host-summary-layout">

        <!-- Left: track answer -->
        <div class="salon-summary">
          {#if roundEnd.cover}
            <img src={roundEnd.cover} alt="" class="salon-summary-cover">
          {/if}
          <div class="salon-summary-reason">{roundEnd.reason}</div>
          <div class="salon-summary-answer">{roundEnd.answer}</div>
          {#if roundEnd.featArtists?.length}
            <div style="font-size:.8rem;color:var(--mid);margin-top:4px">feat. {roundEnd.featArtists.join(', ')}</div>
          {/if}
          {#if roundEnd.firstFinder}
            <div class="salon-summary-first">🏆 Premier : {roundEnd.firstFinder}</div>
          {/if}
        </div>

        <!-- Right: leaderboard -->
        <div class="salon-host-scores-col">
          <div class="salon-host-round-label">
            Manche {round} <span class="salon-host-round-of">/ {total}</span>
          </div>
          <div class="salon-scores-table">
            {#each (roundEnd.scores || players) as p, i (p.username)}
              <div class="salon-scores-row {i < 3 ? 'top' : ''}">
                <div class="salon-scores-medal">{medals[i] || `#${i+1}`}</div>
                <div class="salon-scores-name">{p.username}</div>
                <div class="salon-scores-pts">
                  {p.score} pts
                  {#if p.delta > 0}<span class="salon-score-delta">+{p.delta}</span>{/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

      </div>

    {:else if phase === 'gameover'}
      <div class="salon-gameover">
        <h2>🏆 Classement Final</h2>

        <!-- Podium top 3 -->
        <div class="salon-go-podium">

          <!-- 2nd place — left -->
          <div class="salon-go-slot pos-2">
            {#if finalScores[1]}
              <div class="salon-go-player" class:salon-go-revealed={revealStep >= 2}>
                <div class="salon-go-avatar">{finalScores[1].username[0]?.toUpperCase() ?? '?'}</div>
                <div class="salon-go-name">{finalScores[1].username}</div>
                <div class="salon-go-score">{finalScores[1].score} pts</div>
              </div>
            {:else}
              <div class="salon-go-player salon-go-placeholder salon-go-revealed">
                <div class="salon-go-avatar empty">?</div>
                <div class="salon-go-name">&mdash;</div>
              </div>
            {/if}
            <div class="salon-go-block pos-2">🥈</div>
          </div>

          <!-- 1st place — center -->
          <div class="salon-go-slot pos-1">
            {#if finalScores[0]}
              <div class="salon-go-player" class:salon-go-revealed={revealStep >= 3}>
                <div class="salon-go-avatar gold">{finalScores[0].username[0]?.toUpperCase() ?? '?'}</div>
                <div class="salon-go-name">{finalScores[0].username}</div>
                <div class="salon-go-score">{finalScores[0].score} pts</div>
              </div>
            {:else}
              <div class="salon-go-player salon-go-placeholder salon-go-revealed">
                <div class="salon-go-avatar empty">?</div>
                <div class="salon-go-name">&mdash;</div>
              </div>
            {/if}
            <div class="salon-go-block pos-1">🥇</div>
          </div>

          <!-- 3rd place — right -->
          <div class="salon-go-slot pos-3">
            {#if finalScores[2]}
              <div class="salon-go-player" class:salon-go-revealed={revealStep >= 1}>
                <div class="salon-go-avatar">{finalScores[2].username[0]?.toUpperCase() ?? '?'}</div>
                <div class="salon-go-name">{finalScores[2].username}</div>
                <div class="salon-go-score">{finalScores[2].score} pts</div>
              </div>
            {:else}
              <div class="salon-go-player salon-go-placeholder salon-go-revealed">
                <div class="salon-go-avatar empty">?</div>
                <div class="salon-go-name">&mdash;</div>
              </div>
            {/if}
            <div class="salon-go-block pos-3">🥉</div>
          </div>

        </div>

        <!-- Rest: rank 4+ -->
        {#if finalScores.length > 3}
          <div class="salon-go-rest">
            {#each finalScores.slice(3) as p, i (p.username)}
              <div class="salon-scores-row">
                <div class="salon-scores-medal">#{i + 4}</div>
                <div class="salon-scores-name">{p.username}</div>
                <div class="salon-scores-pts">{p.score} pts</div>
              </div>
            {/each}
          </div>
        {/if}

        <div class="salon-gameover-actions">
          <button class="btn-salon-start" onclick={onRestart}>🔄 Rejouer</button>
          <button class="btn-salon-next" onclick={onNewSalon}>Nouveau salon</button>
        </div>
      </div>

    {:else}
      <div class="salon-info-placeholder"></div>
    {/if}

  </div>

</div>
