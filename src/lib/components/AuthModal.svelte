<script>
  /**
   * @type {{
   *   sb: any,
   *   open: boolean,
   *   view: 'login'|'register'|'confirm',
   *   onClose: () => void,
   *   onSuccess?: () => void
   * }}
   */
  let { sb, open, view = $bindable('login'), onClose, onSuccess } = $props();

  let loginEmail    = $state('');
  let loginPassword = $state('');
  let loginError    = $state('');
  let loginLoading  = $state(false);
  let showLoginPwd  = $state(false);

  let regUsername = $state('');
  let regEmail    = $state('');
  let regPassword = $state('');
  let regError    = $state('');
  let regLoading  = $state(false);
  let showRegPwd  = $state(false);

  function resetFields() {
    loginError = ''; regError = '';
    loginLoading = false; regLoading = false;
  }

  function close() { resetFields(); onClose(); }

  function setView(v) { view = v; resetFields(); }

  async function handleLogin() {
    loginError = '';
    if (!sb) { loginError = 'Supabase non configure.'; return; }
    if (!loginEmail || !loginPassword) { loginError = 'Remplis tous les champs.'; return; }
    loginLoading = true;
    const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    loginLoading = false;
    if (error) {
      const msg = error.message.toLowerCase();
      loginError = msg.includes('invalid') ? 'Email ou mot de passe incorrect.' :
                   msg.includes('confirm') ? 'Confirme ton email avant de te connecter.' :
                   error.message;
    } else {
      onSuccess?.();
    }
  }

  async function handleRegister() {
    regError = '';
    if (!sb) { regError = 'Supabase non configure.'; return; }
    if (!regUsername || !regEmail || !regPassword) { regError = 'Remplis tous les champs.'; return; }
    if (regUsername.length < 3) { regError = 'Pseudo trop court (min. 3 caracteres).'; return; }
    if (regPassword.length < 6) { regError = 'Mot de passe trop court (min. 6 caracteres).'; return; }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(regUsername)) { regError = 'Pseudo invalide (lettres, chiffres, - et _ uniquement).'; return; }

    const { data: exists } = await sb.from('profiles').select('id').eq('username', regUsername).maybeSingle();
    if (exists) { regError = 'Ce pseudo est deja pris.'; return; }

    regLoading = true;
    const { error } = await sb.auth.signUp({ email: regEmail, password: regPassword, options: { data: { username: regUsername } } });
    regLoading = false;
    if (error) regError = error.message;
    else view = 'confirm';
  }

  async function signInWithGoogle() {
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  }
</script>

{#if open}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div id="auth-modal" class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) close(); }}>
  <div class="modal" id="auth-box">
    <button class="close-btn" onclick={close}>&#x2715;</button>

    {#if view === 'login'}
      <div id="view-login">
        <div class="modal-logo">ZIK<span>.</span></div>
        <h2>Bon retour &#x1F44B;</h2>
        <p class="mdesc">Connecte-toi pour sauvegarder tes scores.</p>
        <button class="btn-google" onclick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuer avec Google
        </button>
        <div class="auth-divider"><span>ou</span></div>
        <div class="field"><label for="email">Email</label><input type="email" bind:value={loginEmail} placeholder="ton@email.com" autocomplete="email"></div>
        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="pwd-wrap">
            <input type={showLoginPwd ? 'text' : 'password'} bind:value={loginPassword} placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" autocomplete="current-password"
              onkeypress={e => { if (e.key === 'Enter') handleLogin(); }}>
            <button type="button" class="pwd-eye" onclick={() => showLoginPwd = !showLoginPwd} tabindex="-1">
              {#if showLoginPwd}🙈{:else}👁️{/if}
            </button>
          </div>
        </div>
        {#if loginError}<div class="alert-err">{loginError}</div>{/if}
        <button class="btn-accent full" onclick={handleLogin} disabled={loginLoading}>
          {loginLoading ? 'Connexion...' : 'Se connecter'}
        </button>
        <p class="mswitch">Pas de compte ? <a href="/rooms" onclick={e => { e.preventDefault(); setView('register'); }}>Cr&eacute;er un compte</a></p>
      </div>

    {:else if view === 'register'}
      <div id="view-register">
        <div class="modal-logo">ZIK<span>.</span></div>
        <h2>Cr&eacute;er un compte</h2>
        <p class="mdesc">Rejoins ZIK et suis ta progression.</p>
        <button class="btn-google" onclick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuer avec Google
        </button>
        <div class="auth-divider"><span>ou</span></div>
        <div class="field"><label for="pseudo">Pseudo</label><input type="text" bind:value={regUsername} placeholder="MonPseudo" maxlength="20" autocomplete="username"></div>
        <div class="field"><label for="email">Email</label><input type="email" bind:value={regEmail} placeholder="ton@email.com" autocomplete="email"></div>
        <div class="field">
          <label for="pasword">Mot de passe</label>
          <div class="pwd-wrap">
            <input type={showRegPwd ? 'text' : 'password'} bind:value={regPassword} placeholder="Min. 6 caract&egrave;res" autocomplete="new-password"
              onkeypress={e => { if (e.key === 'Enter') handleRegister(); }}>
            <button type="button" class="pwd-eye" onclick={() => showRegPwd = !showRegPwd} tabindex="-1">
              {#if showRegPwd}🙈{:else}👁️{/if}
            </button>
          </div>
        </div>
        {#if regError}<div class="alert-err">{regError}</div>{/if}
        <button class="btn-accent full" onclick={handleRegister} disabled={regLoading}>
          {regLoading ? 'Cr&eacute;ation...' : 'Cr&eacute;er mon compte'}
        </button>
        <p class="mswitch">D&eacute;j&agrave; un compte ? <a href="/login" onclick={e => { e.preventDefault(); setView('login'); }}>Se connecter</a></p>
      </div>

    {:else if view === 'confirm'}
      <div id="view-confirm">
        <div class="confirm-view">
          <div class="confirm-emoji">&#x1F4EC;</div>
          <h2>V&eacute;rifie tes mails</h2>
          <p class="mdesc">Un lien de confirmation t&apos;a &eacute;t&eacute; envoy&eacute;. Clique dessus puis reviens jouer !</p>
          <button class="btn-ghost full" onclick={close}>Fermer</button>
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}
