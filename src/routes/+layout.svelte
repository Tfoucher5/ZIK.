<script>
  import { onMount, setContext } from 'svelte';
  import Nav from '$lib/components/Nav.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

  let { data, children } = $props();

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
  <link rel="stylesheet" href="/css/home.css">
</svelte:head>

<Nav
  user={currentUser}
  onLogin={() => openAuthModal('login')}
  onRegister={() => openAuthModal('register')}
  onLogout={() => sb?.auth.signOut()}
/>

{@render children()}

<footer class="site-footer">
  <span class="nav-logo">ZIK<span>.</span></span>
  <span>&copy; 2025 ZIK &mdash; Blind Test Multijoueur</span>
  <div class="footer-links">
    <a href="/cgu">CGU</a>
    <a href="/confidentialite">Confidentialit&eacute;</a>
    <a href="mailto:contact@zik.app">Contact</a>
  </div>
</footer>

<AuthModal
  {sb}
  bind:open={authOpen}
  bind:view={authView}
  onClose={() => { authOpen = false; }}
/>
