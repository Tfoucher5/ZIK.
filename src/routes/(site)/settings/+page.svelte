<script>
  import { onMount, getContext } from 'svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let animOn     = $state(true);
  let volVal     = $state(50);
  let isPrivate  = $state(false);
  let privLoading = $state(false);

  let toastMsg  = $state('');
  let toastType = $state('');
  let _toastTimer = null;

  function toast(msg, type = '') {
    clearTimeout(_toastTimer);
    toastMsg = msg; toastType = type;
    _toastTimer = setTimeout(() => { toastMsg = ''; }, 3200);
  }

  onMount(() => {
    animOn = localStorage.getItem('zik_animations') !== 'off';
    volVal = parseInt(localStorage.getItem('zik_vol') ?? '50');
    const el = document.getElementById('pref-volume');
    if (el) el.style.setProperty('--vol', volVal + '%');
  });

  // Load privacy setting from profile when user is available
  $effect(() => {
    if (user?.profile) {
      isPrivate = user.profile.is_private ?? false;
    }
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

  async function togglePrivacy(e) {
    const newVal = e.target.checked;
    if (!sb || !user) return;
    privLoading = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_private: newVal }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      isPrivate = newVal;
      // Update cached profile
      if (user.profile) user.profile.is_private = newVal;
      toast(newVal ? 'Profil mis en priv\u00e9' : 'Profil mis en public', 'success');
    } catch (e) {
      toast('Erreur : ' + e.message, 'error');
    } finally {
      privLoading = false;
    }
  }
</script>

<svelte:head>
  <title>ZIK — Paramètres</title>
  <meta name="robots" content="noindex, nofollow">
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

    {#if authReady && user}
    <section class="settings-section">
      <h2 class="settings-section-title">Confidentialit&eacute;</h2>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">Profil priv&eacute; &#x1F510;</div>
          <div class="settings-row-desc">
            {#if isPrivate}
              Ton profil est <strong>priv&eacute;</strong> : seul toi peux voir tes stats et meilleurs scores.
            {:else}
              Ton profil est <strong>public</strong> : n&apos;importe quel joueur connect&eacute; peut voir tes stats.
            {/if}
          </div>
        </div>
        <label class="toggle-switch" aria-label="Profil priv&eacute;">
          <input type="checkbox" checked={isPrivate} onchange={togglePrivacy} disabled={privLoading}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>
    </section>
    {/if}

  </div>
</main>

{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}
