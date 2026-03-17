<script>
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/state';
  import Nav from '$lib/components/Nav.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

  const isGame = $derived(page.url.pathname.startsWith('/game'));

  let { data, children } = $props();

  // svelte-ignore state_referenced_locally
  const { supabaseUrl, supabaseAnonKey, spotifyClientId } = data.env;
  const sb = createSupabaseClient(supabaseUrl, supabaseAnonKey);

  let currentUser = $state(null);
  let authReady   = $state(false);
  let authOpen    = $state(false);
  let authView    = $state('login');

  setContext('zik', {
    get sb()          { return sb; },
    get user()        { return currentUser; },
    get authReady()   { return authReady; },
    openAuthModal,
    get spotifyClientId() { return spotifyClientId; },
  });

  const PROFILE_TTL = 5 * 60 * 1000;
  function getCachedProfile(uid) {
    try {
      const raw = sessionStorage.getItem('zik_profile_' + uid);
      if (!raw) return null;
      const { p, ts } = JSON.parse(raw);
      if (Date.now() - ts > PROFILE_TTL) { sessionStorage.removeItem('zik_profile_' + uid); return null; }
      return p;
    } catch { return null; }
  }
  function setCachedProfile(uid, profile) {
    try { sessionStorage.setItem('zik_profile_' + uid, JSON.stringify({ p: profile, ts: Date.now() })); } catch {}
  }
  function clearCachedProfile(uid) {
    try { if (uid) sessionStorage.removeItem('zik_profile_' + uid); } catch {}
  }

  async function applyUser(user) {
    try {
      let profile = getCachedProfile(user.id);
      if (!profile) {
        const { data: d } = await sb.from('profiles').select('*').eq('id', user.id).single();
        profile = d;
        if (profile) setCachedProfile(user.id, profile);
      }
      currentUser = { ...user, profile };
      sessionStorage.setItem('zik_uid',   user.id);
      sessionStorage.setItem('zik_uname', profile?.username || user.email?.split('@')[0] || 'Joueur');
    } catch {
      currentUser = { ...user, profile: null };
      sessionStorage.setItem('zik_uid',   user.id);
      sessionStorage.setItem('zik_uname', user.email?.split('@')[0] || 'Joueur');
    }
  }

  function openAuthModal(view = 'login') {
    authView = view;
    authOpen = true;
  }

  onMount(async () => {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await applyUser(session.user);

    authReady = true;
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await applyUser(session.user);
        authOpen = false;
      } else if (event === 'SIGNED_OUT') {
        clearCachedProfile(currentUser?.id);
        currentUser = null;
        sessionStorage.removeItem('zik_uid');
        sessionStorage.removeItem('zik_uname');
      }
    });
  });
</script>

<svelte:head>
  <meta name="description" content="ZIK — Blind test musical multijoueur en ligne. Rejoins une room, trouve les titres avant tout le monde et grimpe dans le classement ELO. Gratuit, sans téléchargement.">
  <meta name="keywords" content="blind test, quiz musical, blind test en ligne, blind test multijoueur, jeu musique, deviner chansons, blind test gratuit, musique en ligne">
  <meta name="author" content="ZIK">
  <meta name="theme-color" content="#7c3aed">

  <!-- Open Graph -->
  <meta property="og:site_name" content="ZIK">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:image" content="https://zik.app/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="ZIK — Blind Test Multijoueur">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://zik.app/og.png">

  <link rel="stylesheet" href="/css/home.css">
</svelte:head>

{#if !isGame}
<Nav
  user={currentUser}
  onLogin={() => openAuthModal('login')}
  onRegister={() => openAuthModal('register')}
  onLogout={() => sb?.auth.signOut()}
/>
{/if}

{@render children()}

{#if !isGame}
<footer class="site-footer">
  <span class="nav-logo">ZIK<span>.</span></span>
  <span>&copy; 2025 ZIK &mdash; Blind Test Multijoueur</span>
  <div class="footer-links">
    <a href="/cgu">CGU</a>
    <a href="/confidentialite">Confidentialit&eacute;</a>
    <a href="mailto:contact@zik.app">Contact</a>
  </div>
</footer>
{/if}

<AuthModal
  {sb}
  bind:open={authOpen}
  bind:view={authView}
  onClose={() => { authOpen = false; }}
/>
