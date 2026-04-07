<script>
  let {
    round = 0, total = 10,
    timerVal = 0, timerMax = 30, timerStarted = false,
    answerMode = 'free',
    choices = null,
    foundArtist = false,
    foundTitle = false,
    foundFeats = [],
    useCustomSlots = false,
    answerSlots = [],
    allFound = false,
    chosenIndex = null,
    revealCorrectIndex = null,
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

{#if !timerStarted}
  <div class="salon-music-loading">
    <div class="waiting-dots"><span>●</span><span>●</span><span>●</span></div>
    <p>Chargement de la musique…</p>
  </div>

{:else if answerMode === 'free'}
  <div class="salon-progress-row">
    {#if useCustomSlots}
      {#each answerSlots as slot}
        <span class="salon-progress-chip {slot.found ? 'found' : ''}">{slot.label}</span>
      {/each}
    {:else}
      <span class="salon-progress-chip {foundArtist ? 'found' : ''}">🎤 Artiste</span>
      {#each foundFeats as ff, i (i)}
        <span class="salon-progress-chip {ff ? 'found' : ''}">🎸 Feat {i + 1}</span>
      {/each}
      <span class="salon-progress-chip {foundTitle ? 'found' : ''}">🎵 Titre</span>
    {/if}
  </div>

  {#if allFound}
    <div class="salon-all-found">
      <div class="salon-all-found-emoji">🎉</div>
      <div class="salon-all-found-text">Tout trouvé !</div>
      <div class="salon-all-found-sub">En attente des autres…</div>
    </div>
  {:else}
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
  {/if}

{:else if answerMode === 'multiple' && choices}
  <!-- QCM: choices always visible — state classes drive the reveal animation -->
  <div class="salon-choices">
    {#each choices as choice, i (i)}
      {@const isChosen = chosenIndex === i}
      {@const isRevealing = revealCorrectIndex !== null}
      {@const isCorrect = isRevealing && i === revealCorrectIndex}
      {@const isWrong = isRevealing && isChosen && !isCorrect}
      {@const isNeutral = isRevealing && !isChosen && !isCorrect}
      <button
        class="salon-choice-btn c{i}"
        class:is-selected={isChosen && !isRevealing}
        class:is-waiting={!isChosen && chosenIndex !== null && !isRevealing}
        class:reveal-correct={isCorrect}
        class:reveal-wrong={isWrong}
        class:reveal-neutral={isNeutral}
        onclick={() => onSubmitChoice(i)}
        disabled={allFound}
      >
        <span class="choice-shape"></span>
        <span class="choice-text">{choice}</span>
      </button>
    {/each}
  </div>

  {#if chosenIndex !== null && !isNaN(chosenIndex) && revealCorrectIndex === null}
    <p class="salon-qcm-waiting">
      <span class="waiting-dots"><span>●</span><span>●</span><span>●</span></span>
      Réponse verrouillée
    </p>
  {/if}
{/if}
