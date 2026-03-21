<script>
  let { players = [], phase = 'lobby', answerMode = 'free' } = $props();
</script>

<div class="salon-host-sidebar">
  <div class="salon-sidebar-title">Joueurs</div>
  <div class="salon-players-list">
    {#each players as p, i (p.username)}
      <div class="salon-player-row">
        <div class="salon-player-rank">{i + 1}</div>
        <div class="salon-player-name">{p.username}</div>
        <div class="salon-player-score">{p.score ?? 0}</div>
        {#if phase === 'round' || phase === 'summary'}
          <div class="salon-player-found">
            {#if answerMode === 'multiple'}
              <!-- QCM: just show "answered" (✓) — no correctness reveal during round -->
              {#if p.answeredThisRound || p.foundThisRound}
                <span class="found-el" title="A répondu">✓</span>
              {:else}
                <span class="found-el empty">…</span>
              {/if}
            {:else}
              <!-- Free mode: show individual element discovery -->
              {#if p.foundArtist}
                <span class="found-el" title="Artiste">🎤</span>
              {:else}
                <span class="found-el empty">🎤</span>
              {/if}
              {#if (p.totalFeatCount || 0) > 0}
                {#if (p.foundFeatCount || 0) > 0}
                  <span class="found-el" title="Feat">{p.foundFeatCount}🎸</span>
                {:else}
                  <span class="found-el empty">🎸</span>
                {/if}
              {/if}
              {#if p.foundTitle}
                <span class="found-el" title="Titre">🎵</span>
              {:else}
                <span class="found-el empty">🎵</span>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
