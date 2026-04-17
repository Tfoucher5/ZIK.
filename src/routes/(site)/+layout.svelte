<script>
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/state';
  import Nav from '$lib/components/Nav.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import AnnouncementPopup from '$lib/components/AnnouncementPopup.svelte';
  import ContactModal from '$lib/components/ContactModal.svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

  const isGame = $derived(page.url.pathname.startsWith('/game'));

  let { data, children } = $props();

  // svelte-ignore state_referenced_locally
  const { supabaseUrl, supabaseAnonKey, spotifyClientId } = data.env;
  const sb = createSupabaseClient(supabaseUrl, supabaseAnonKey);

  let currentUser = $state(null);
  let authReady   = $state(false);
  let authOpen     = $state(false);
  let authView     = $state('login');
  let contactOpen  = $state(false);

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
    try { sessionStorage.setItem('zik_profile_' + uid, JSON.stringify({ p: profile, ts: Date.now() })); } catch { /* sessionStorage unavailable */ }
  }
  function clearCachedProfile(uid) {
    try { if (uid) sessionStorage.removeItem('zik_profile_' + uid); } catch { /* sessionStorage unavailable */ }
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
    if (!sb) { authReady = true; return; }
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) await applyUser(session.user);
    } catch {
      /* session fetch failed — still mark auth as ready */
    }

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
  <meta name="keywords" content="blind test, blind test en ligne, blind test gratuit, blind test multijoueur, quiz musical en ligne, jeu de musique, deviner les chansons, jeu musique gratuit, blind test kahoot, blind test soirée, blind test spotify, blind test deezer, jeu blind test, musique en ligne">
  <meta name="author" content="ZIK">
  <meta name="theme-color" content="#7c3aed">
  <meta name="format-detection" content="telephone=no">

  <!-- Open Graph -->
  <meta property="og:site_name" content="ZIK">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="ZIK — Blind Test Multijoueur en Ligne Gratuit">
  <meta property="og:description" content="Blind test multijoueur gratuit en ligne. Spotify & Deezer, classement ELO, Mode Salon. Joue maintenant sans inscription.">
  <meta property="og:url" content="https://www.zik-music.fr/">
  <meta property="og:image" content="https://www.zik-music.fr/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="ZIK — Blind Test Multijoueur">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="ZIK — Blind Test Multijoueur en Ligne Gratuit">
  <meta name="twitter:description" content="Blind test multijoueur gratuit. Importe tes playlists Spotify/Deezer, grimpe dans le classement ELO. Sans installation.">
  <meta name="twitter:image" content="https://www.zik-music.fr/og.png">

  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/animations.css">
</svelte:head>

{#if !isGame}
<Nav
  user={currentUser}
  onLogin={() => openAuthModal('login')}
  onRegister={() => openAuthModal('register')}
  onLogout={() => sb?.auth.signOut()}
/>
{/if}

<AnnouncementPopup {sb} />

{@render children()}

{#if !isGame}
<footer class="site-footer">
  <div class="footer-grid">
    <!-- Brand -->
    <div class="footer-brand">
      <a href="/" class="footer-logo">ZIK<span>.</span></a>
      <p class="footer-tagline">Le blind test multijoueur en ligne. Gratuit, sans installation, directement dans le navigateur.</p>
      <span class="footer-badge">
        <span class="footer-badge-dot"></span>
        En ligne · zik-music.fr
      </span>
    </div>

    <!-- Jouer -->
    <div class="footer-col">
      <p class="footer-col-title">Jouer</p>
      <div class="footer-col-links">
        <a href="/rooms">Rooms</a>
        <a href="/playlists">Playlists</a>
        <a href="/salon">Mode Salon</a>
        <a href="/docs">Documentation</a>
      </div>
    </div>

    <!-- Compte -->
    <div class="footer-col">
      <p class="footer-col-title">Compte</p>
      <div class="footer-col-links">
        <a href="/profile">Mon profil</a>
        <a href="/settings">Paramètres</a>
      </div>
    </div>

    <!-- Légal -->
    <div class="footer-col">
      <p class="footer-col-title">Légal</p>
      <div class="footer-col-links">
        <a href="/cgu">CGU</a>
        <a href="/confidentialite">Confidentialité</a>
        <a href="/mentions-legales">Mentions légales</a>
        <button class="footer-contact-btn" onclick={() => contactOpen = true}>Contact</button>
      </div>
    </div>
  </div>

  <div class="footer-bottom">
    <span class="footer-copy">© 2026 ZIK · Fait avec ❤️ et beaucoup de musique · par <a href="/portfolio">Theo Foucher</a></span>
    <span class="footer-version-tag">v2.1.0</span>
  </div>
</footer>
{/if}

<AuthModal
  {sb}
  bind:open={authOpen}
  bind:view={authView}
  onClose={() => { authOpen = false; }}
/>

<ContactModal bind:open={contactOpen} />
