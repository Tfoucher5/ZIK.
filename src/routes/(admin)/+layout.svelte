<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createClient } from '@supabase/supabase-js';

  let { data, children } = $props();

  let adminUsername = $state('');
  let ready = $state(false);

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
    ready = true;
  });
</script>

<svelte:head>
  <title>ZIK Admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</svelte:head>

{#if ready}
<div class="adm-root">
  <nav class="adm-nav">
    <a href="/" class="adm-logo">ZIK<span>.</span></a>
    <div class="adm-nav-links">
      <a href="/admin/reports" class="adm-nav-link">📋 Reports</a>
    </div>
    <div class="adm-nav-user">
      <span class="adm-badge">super_admin</span>
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
  background: #0a0a12;
  color: #e2e8f0;
  font-family: "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}
:global(a) { text-decoration: none; color: inherit; }

.adm-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.adm-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  height: 56px;
  background: #111827;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.adm-logo {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 800;
  font-size: 1.3rem;
  letter-spacing: -0.5px;
}
.adm-logo span { color: #6366f1; }

.adm-nav-links { display: flex; gap: 4px; flex: 1; }
.adm-nav-link {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: #94a3b8;
  transition: background 0.15s, color 0.15s;
}
.adm-nav-link:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }

.adm-nav-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.adm-badge {
  background: rgba(99,102,241,0.2);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 0.72rem;
  font-weight: 600;
}
.adm-username { font-size: 0.82rem; color: #64748b; }

.adm-main {
  flex: 1;
  padding: 28px 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}
</style>
