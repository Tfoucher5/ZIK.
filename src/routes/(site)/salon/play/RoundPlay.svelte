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

  // SVG arc timer — circumference of r=44: 2π×44 ≈ 276.46
  const CIRCUMFERENCE = 276.46;

  function timerPct() {
    return timerMax ? Math.max(0, (timerVal / timerMax) * 100) : 100;
  }

  function timerClass() {
    const p = timerPct();
    if (p < 20) return 'danger';
    if (p < 40) return 'warning';
    return '';
  }

  function arcOffset() {
    return ((1 - timerPct() / 100) * CIRCUMFERENCE).toFixed(2);
  }
</script>

<!-- Progress bar (top of screen) -->
<div class="salon-timer-bar">
  <div class="salon-timer-fill" style="width:{timerPct()}%"></div>
</div>

<div class="salon-play-round">
  Manche <strong>{round} / {total}</strong>
</div>

<!-- SVG arc countdown timer -->
<div class="salon-timer-wrap">
  <svg class="salon-timer-svg" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="timer-track" cx="50" cy="50" r="44" />
    <circle
      class="timer-arc {timerClass()}"
      cx="50" cy="50" r="44"
      style="stroke-dashoffset: {arcOffset()}"
    />
  </svg>
  <div class="salon-timer-num {timerClass()}">{timerVal}</div>
</div>

{#if answerMode === 'free'}
  <div class="salon-progress-row">
    <span class="salon-progress-chip {foundArtist ? 'found' : ''}">
      🎤 Artiste
    </span>
    {#each foundFeats as ff, i (i)}
      <span class="salon-progress-chip {ff ? 'found' : ''}">
        🎸 Feat {i + 1}
      </span>
    {/each}
    <span class="salon-progress-chip {foundTitle ? 'found' : ''}">
      🎵 Titre
    </span>
  </div>
{/if}

{#if allFound}
  <div class="salon-all-found">
    <div class="salon-all-found-emoji">🎉</div>
    <div class="salon-all-found-text">Tout trouvé !</div>
    <div class="salon-all-found-sub">En attente des autres…</div>
  </div>
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
    {#each choices as choice, i (i)}
      <button class="salon-choice-btn c{i}" onclick={() => onSubmitChoice(i)} disabled={allFound}>
        <span class="choice-shape"></span>
        <span class="choice-text">{choice}</span>
      </button>
    {/each}
  </div>
{/if}
