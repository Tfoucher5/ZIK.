<script>
  import { dicebear } from '$lib/utils.js';

  /** @type {{ user: any, onLogin: () => void, onRegister: () => void, onLogout: () => void }} */
  let { user, onLogin, onRegister, onLogout } = $props();

  let dropdownOpen = $state(false);

  const name   = $derived(user?.profile?.username || user?.email?.split('@')[0] || 'Joueur');
  const avatar = $derived(user?.profile?.avatar_url || dicebear(name));

  function toggleDropdown(e) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }
</script>

<svelte:window onclick={() => { dropdownOpen = false; }} />

<nav id="navbar">
  <a href="/" class="nav-logo">ZIK<span>.</span></a>
  <div class="nav-right">
    {#if user}
      <div id="nav-user" style="display:flex">
        <a href="/rooms"     class="btn-ghost sm" style="text-decoration:none">Rooms</a>
        <a href="/playlists" class="btn-ghost sm" style="text-decoration:none">Mes playlists</a>
        <div class="nav-profile-wrap">
          <button class="nav-avatar-wrap" onclick={toggleDropdown} aria-haspopup="true">
            <img id="nav-avatar" src={avatar} alt="" width="28" height="28">
            <span id="nav-username">{name}</span>
            <span class="nav-chevron">&#x25BE;</span>
          </button>
          <div class="nav-dropdown" class:open={dropdownOpen}>
            <a href="/rooms"     class="nav-dd-item nav-dd-mobile-only">Rooms</a>
            <a href="/playlists" class="nav-dd-item nav-dd-mobile-only">Mes playlists</a>
            <a href="/salon"     class="nav-dd-item nav-dd-mobile-only">Mode Salon</a>
            <hr class="nav-dd-sep nav-dd-mobile-only">
            <a href="/profile"  class="nav-dd-item">Mon profil</a>
            <a href="/settings" class="nav-dd-item">Param&egrave;tres</a>
            {#if user?.profile?.role === 'super_admin'}
            <hr class="nav-dd-sep">
            <a href="/admin" class="nav-dd-item nav-dd-admin">Admin</a>
            {/if}
            <button class="nav-dd-item nav-dd-logout" onclick={onLogout}>D&eacute;connexion</button>
          </div>
        </div>
      </div>
    {:else}
      <div id="nav-auth" style="display:flex">
        <button class="btn-ghost sm"  onclick={onLogin}>Connexion</button>
        <button class="btn-accent sm" onclick={onRegister}>S&apos;inscrire</button>
      </div>
    {/if}
  </div>
</nav>
