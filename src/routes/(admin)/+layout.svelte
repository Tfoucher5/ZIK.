<script>
  import { onMount, setContext } from 'svelte';
  import { goto } from '$app/navigation';
  import { createClient } from '@supabase/supabase-js';

  let { data, children } = $props();

  let adminUsername = $state('');
  let ready = $state(false);
  let adminToken = $state('');

  setContext('adminToken', { get token() { return adminToken; } });

  onMount(async () => {
    const sb = createClient(data.env.supabaseUrl, data.env.supabaseAnonKey);
    const { data: { session } } = await sb.auth.getSession();

    if (!session?.user) { goto('/'); return; }

    const { data: profile } = await sb
      .from('profiles')
      .select('role, username')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'super_admin') { goto('/'); return; }

    adminUsername = profile.username || session.user.email;
    adminToken = session.access_token;
    ready = true;
  });
</script>

<svelte:head>
  <title>ZIK Admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</svelte:head>

{#if ready}
<div class="adm-root">
  <nav class="adm-nav">
    <a href="/" class="adm-logo">ZIK<span>.</span></a>
    <div class="adm-nav-links">
      <a href="/admin/dashboard" class="adm-nav-link">⬡ Dashboard</a>
      <a href="/admin/users"     class="adm-nav-link">◈ Users</a>
      <a href="/admin/reports"   class="adm-nav-link">◉ Reports</a>
      <a href="/admin/rooms"     class="adm-nav-link">◧ Rooms</a>
      <a href="/admin/playlists" class="adm-nav-link">◫ Playlists</a>
      <a href="/admin/live"      class="adm-nav-link">◎ Live</a>
    </div>
    <div class="adm-nav-user">
      <span class="adm-badge">ROOT</span>
      <span class="adm-username">{adminUsername}</span>
    </div>
  </nav>

  <main class="adm-main">
    {@render children()}
  </main>
</div>
{/if}

<style>
:global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
:global(body) {
  background: #0a0a0f;
  color: #00ff41;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  -webkit-font-smoothing: antialiased;
}
:global(a) { text-decoration: none; color: inherit; }

.adm-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Scan-lines overlay */
.adm-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.04) 2px,
    rgba(0, 0, 0, 0.04) 4px
  );
  pointer-events: none;
  z-index: 9999;
}

.adm-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  height: 52px;
  background: rgba(0, 255, 65, 0.04);
  border-bottom: 1px solid rgba(0, 255, 65, 0.2);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.adm-logo {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.5px;
  color: #00ff41;
}
.adm-logo span { color: #ffb300; }

.adm-nav-links { display: flex; gap: 2px; flex: 1; }
.adm-nav-link {
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(0, 255, 65, 0.5);
  transition: background 0.1s, color 0.1s;
  letter-spacing: 0.05em;
}
.adm-nav-link:hover {
  background: rgba(0, 255, 65, 0.08);
  color: #00ff41;
}

.adm-nav-user { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.adm-badge {
  background: rgba(255, 179, 0, 0.15);
  color: #ffb300;
  border: 1px solid rgba(255, 179, 0, 0.4);
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.adm-username { font-size: 0.75rem; color: rgba(0, 255, 65, 0.4); }

.adm-main {
  flex: 1;
  padding: 28px 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}
</style>
