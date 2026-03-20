<script>
  let {
    round = 0, total = 10,
    timerVal = 0, timerMax = 30,
    answerMode = 'free',
    choices = null,
    foundArtist = false,
    foundTitle = false,
    foundFeats = [],
    allFound = false,
    guess = $bindable(''),
    onSubmitGuess,
    onSubmitChoice,
  } = $props();

  function timerPct() {
    return timerMax ? Math.max(0, (timerVal / timerMax) * 100) : 100;
  }

  function timerClass() {
    const p = timerPct();
    if (p < 20) return 'danger';
    if (p < 40) return 'warning';
    return '';
  }
</script>

<div class="salon-timer-bar">
  <div class="salon-timer-fill" style="width:{timerPct()}%;background:{timerPct() > 60 ? '#4ade80' : timerPct() > 30 ? '#fbbf24' : '#f87171'}"></div>
</div>

<div class="salon-play-round">
  Manche <strong>{round} / {total}</strong>
</div>
<div class="salon-play-timer {timerClass()}">{timerVal}</div>

{#if answerMode === 'free'}
  <div class="salon-progress-row">
    <span class="salon-progress-chip {foundArtist ? 'found' : ''}">
      {foundArtist ? '✓' : '○'} Artiste
    </span>
    {#each foundFeats as ff, i}
      <span class="salon-progress-chip {ff ? 'found' : ''}">
        {ff ? '✓' : '○'} Feat {i + 1}
      </span>
    {/each}
    <span class="salon-progress-chip {foundTitle ? 'found' : ''}">
      {foundTitle ? '✓' : '○'} Titre
    </span>
  </div>
{/if}

{#if allFound}
  <p style="color:var(--accent2);font-size:.95rem;text-align:center;font-weight:700">Tout trouvé ! 🎉</p>
  <p style="color:var(--mid);font-size:.85rem;text-align:center">En attente des autres…</p>
{:else if answerMode === 'free'}
  <div class="salon-play-guess">
    <input
      id="salon-guess-input"
      type="text"
      bind:value={guess}
      placeholder="Artiste, titre, feat…"
      maxlength="100"
      autocomplete="off"
      spellcheck="false"
      onkeydown={e => { if (e.key === 'Enter') onSubmitGuess(); }}
    >
    <button class="btn-salon-submit" onclick={onSubmitGuess} disabled={!guess.trim()}>
      Envoyer
    </button>
  </div>
{:else if answerMode === 'multiple' && choices}
  <div class="salon-choices">
    {#each choices as choice, i}
      <button class="salon-choice-btn c{i}" onclick={() => onSubmitChoice(i)} disabled={allFound}>
        {choice}
      </button>
    {/each}
  </div>
{/if}
