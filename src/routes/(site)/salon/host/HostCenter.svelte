<script>
  import { onMount, onDestroy } from 'svelte';

  let {
    phase = 'lobby', code = '', timerVal = 0, timerMax = 30,
    currentPhrase = '', players = [],
    roundEnd = null, finalScores = [],
    onRestart, onNewSalon,
  } = $props();

  const medals = ['🥇', '🥈', '🥉'];
  const VIS_BARS = Array.from({ length: 18 }, (_, i) => i);

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
          events: { onReady: (e) => e.target.playVideo() },
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
  onDestroy(() => { if (ytPlayer?.destroy) ytPlayer.destroy(); });
</script>

<div class="salon-host-center">

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
        {#each players as p, i (p.username)}
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
          {#each finalScores as p, i (p.username)}
            <div class="salon-scores-row {i < 3 ? 'top' : ''}">
              <div class="salon-scores-medal">{medals[i] || `#${i+1}`}</div>
              <div class="salon-scores-name">{p.username}</div>
              <div class="salon-scores-pts">{p.score} pts</div>
            </div>
          {/each}
        </div>
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
