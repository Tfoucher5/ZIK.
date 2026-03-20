<script>
  let {
    codeInput = $bindable(''),
    usernameInput = $bindable(''),
    joinError = '',
    joining = false,
    onJoin,
  } = $props();
</script>

<div class="salon-join">
  <div class="salon-join-logo">ZIK <span>Salon</span></div>
  <div class="salon-join-card">
    <h2>🛋️ Rejoindre un salon</h2>
    <div class="salon-join-field">
      <label>Code du salon</label>
      <input
        type="text"
        bind:value={codeInput}
        placeholder="ABCDEF"
        maxlength="6"
        autocomplete="off"
        spellcheck="false"
        oninput={e => { codeInput = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
        onkeydown={e => { if (e.key === 'Enter') onJoin(); }}
      >
    </div>
    <div class="salon-join-field">
      <label>Pseudo</label>
      <input
        class="normal"
        type="text"
        bind:value={usernameInput}
        placeholder="MonPseudo"
        maxlength="20"
        autocomplete="off"
        onkeydown={e => { if (e.key === 'Enter') onJoin(); }}
      >
    </div>
    {#if joinError}
      <p style="color:var(--danger);font-size:.85rem;text-align:center">{joinError}</p>
    {/if}
    <button class="btn-salon-join" onclick={onJoin} disabled={joining}>
      {joining ? 'Connexion…' : 'Rejoindre →'}
    </button>
  </div>
</div>
