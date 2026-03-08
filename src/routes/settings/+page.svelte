<script>
  import { onMount } from 'svelte';

  let animOn  = $state(true);
  let volVal  = $state(50);

  onMount(() => {
    animOn = localStorage.getItem('zik_animations') !== 'off';
    volVal = parseInt(localStorage.getItem('zik_vol') ?? '50');
    const el = document.getElementById('pref-volume');
    if (el) el.style.setProperty('--vol', volVal + '%');
  });

  function toggleAnim(e) {
    animOn = e.target.checked;
    localStorage.setItem('zik_animations', animOn ? 'on' : 'off');
    document.documentElement.classList.toggle('no-animations', !animOn);
  }

  function changeVol(e) {
    volVal = parseInt(e.target.value);
    e.target.style.setProperty('--vol', volVal + '%');
    localStorage.setItem('zik_vol', volVal);
  }
</script>

<svelte:head>
  <title>ZIK &mdash; Param&egrave;tres</title>
  <link rel="stylesheet" href="/css/settings.css">
</svelte:head>

<main class="settings-page">
  <div class="settings-container">
    <button class="settings-back" onclick={() => history.back()}>&larr; Retour</button>
    <h1 class="settings-title">Param&egrave;tres</h1>
    <p class="settings-sub">Personnalise ton exp&eacute;rience ZIK.</p>

    <section class="settings-section">
      <h2 class="settings-section-title">Visuel</h2>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Animations</div>
          <div class="settings-row-desc">Active ou d&eacute;sactive les animations de l&apos;interface (cartes, scores, transitions). D&eacute;sactivez si vous ressentez des ralentissements.</div>
        </div>
        <label class="toggle-switch" aria-label="Activer les animations">
          <input type="checkbox" checked={animOn} onchange={toggleAnim}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section-title">Jeu</h2>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Volume par d&eacute;faut</div>
          <div class="settings-row-desc">Volume de la musique au d&eacute;marrage d&apos;une partie.</div>
        </div>
        <div class="settings-vol-wrap">
          <input id="pref-volume" type="range" min="0" max="100" step="5" value={volVal} oninput={changeVol}>
          <span class="settings-vol-val">{volVal}%</span>
        </div>
      </div>
    </section>
  </div>
</main>
