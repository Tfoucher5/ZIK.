<script>
  let {
    phase = 'summary',
    roundEnd = null,
    finalScores = [],
    scores = [],
    username = '',
    onLeave,
  } = $props();

  const medals = ['🥇', '🥈', '🥉'];
</script>

{#if phase === 'summary' && roundEnd}
  <div class="salon-play-roundend">
    {#if roundEnd.cover}
      <img src={roundEnd.cover} alt="" class="cover">
    {/if}
    <div class="answer">{roundEnd.answer}</div>
    {#if roundEnd.featArtists?.length}
      <div style="font-size:.78rem;color:var(--mid);margin-top:2px">feat. {roundEnd.featArtists.join(', ')}</div>
    {/if}
    {#if roundEnd.firstFinder}
      <p style="font-size:.8rem;color:var(--accent2)">🏆 Premier : {roundEnd.firstFinder}</p>
    {/if}
  </div>
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
  <button class="btn-salon-join" onclick={onLeave} style="margin-top:8px">
    Rejoindre un autre salon
  </button>
{/if}
