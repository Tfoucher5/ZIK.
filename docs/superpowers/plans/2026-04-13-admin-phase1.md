# ZIK Admin Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'espace admin Phase 1 : sécurité server-side + dashboard darknet (stats + live SSE) + gestion complète des users (liste, fiche, ban/unban/modif/suppression).

**Architecture:** Routes SvelteKit `(admin)` existantes étendues avec nouvelles pages server-side. Mutations protégées par `requireAdmin()` qui valide le JWT depuis le formData. Dashboard live via SSE endpoint indépendant de Socket.io. Toutes les actions sont loggées dans `admin_audit_log`.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Supabase JS SDK (service key via `getAdminClient()`), SSE natif (ReadableStream), CSS pur (style terminal darknet).

**Branche :** `feat/admin-phase1`

---

## Fichiers créés / modifiés

| Fichier                                               | Action   | Rôle                                           |
| ----------------------------------------------------- | -------- | ---------------------------------------------- |
| `src/lib/server/middleware/auth.js`                   | Modifier | Ajouter `requireAdmin()` et `logAdminAction()` |
| `src/routes/(admin)/+layout.svelte`                   | Modifier | Nav links + `setContext('adminToken')`         |
| `src/routes/(admin)/admin/+page.server.js`            | Modifier | Redirect → `/admin/dashboard`                  |
| `src/routes/(admin)/admin/dashboard/+page.server.js`  | Créer    | Queries stats globales                         |
| `src/routes/(admin)/admin/dashboard/+page.svelte`     | Créer    | UI darknet + SSE client                        |
| `src/routes/(site)/api/admin/live/+server.js`         | Créer    | SSE endpoint live                              |
| `src/routes/(admin)/admin/users/+page.server.js`      | Créer    | Liste users paginée + search                   |
| `src/routes/(admin)/admin/users/+page.svelte`         | Créer    | Tableau users                                  |
| `src/routes/(admin)/admin/users/[id]/+page.server.js` | Créer    | Fiche user + toutes les actions                |
| `src/routes/(admin)/admin/users/[id]/+page.svelte`    | Créer    | Fiche + forms d'actions                        |

---

## Task 1 : Migration BDD — table `admin_audit_log`

**Files:**

- Supabase SQL (via MCP `apply_migration`)

- [ ] **Appliquer la migration SQL via Supabase MCP**

```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,
  target_id   uuid,
  target_type text,
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Immuable : personne ne peut UPDATE ni DELETE
CREATE POLICY "no update" ON public.admin_audit_log FOR UPDATE USING (false);
CREATE POLICY "no delete" ON public.admin_audit_log FOR DELETE USING (false);
-- Seul le service key (bypass RLS) peut INSERT et SELECT
```

- [ ] **Vérifier dans Supabase Table Editor** que la table `admin_audit_log` apparaît avec les bonnes colonnes.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(admin): migration admin_audit_log"
```

---

## Task 2 : `requireAdmin()` + `logAdminAction()` dans auth.js

**Files:**

- Modify: `src/lib/server/middleware/auth.js`

- [ ] **Ajouter les deux fonctions à la fin de auth.js**

```js
import { getAdminClient } from "../config.js";

// Vérifie que la requête vient bien d'un super_admin.
// Lit le JWT depuis le champ _token du formData (consomme le body → retourne formData).
export async function requireAdmin(request) {
  const formData = await request.formData();
  const token = formData.get("_token");
  if (!token) throw error(403, "Token manquant");

  const user = await verifyToken(token);
  if (!user) throw error(403, "Token invalide");

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw error(403, "Accès refusé");

  return { adminUser: user, formData };
}

// Logue une action admin dans admin_audit_log.
export async function logAdminAction(
  adminId,
  action,
  targetId,
  targetType,
  payload = {},
) {
  await getAdminClient()
    .from("admin_audit_log")
    .insert({
      admin_id: adminId,
      action,
      target_id: targetId,
      target_type: targetType,
      payload,
    });
}
```

> **Note :** `requireAdmin` retourne le `formData` consommé pour que l'action appelante puisse lire les autres champs sans rappeler `request.formData()`.

- [ ] **Vérifier** que le fichier compile sans erreur : `npm run lint` (0 errors).

- [ ] **Commit**

```bash
git add src/lib/server/middleware/auth.js
git commit -m "feat(admin): requireAdmin() et logAdminAction()"
```

---

## Task 3 : SSE endpoint `/api/admin/live`

**Files:**

- Create: `src/routes/(site)/api/admin/live/+server.js`

- [ ] **Créer le fichier**

```js
import { error } from "@sveltejs/kit";
import { verifyToken } from "$lib/server/middleware/auth.js";
import { getAdminClient } from "$lib/server/config.js";

export async function GET({ url, request }) {
  const token = url.searchParams.get("token");
  if (!token) throw error(403, "Token manquant");

  const user = await verifyToken(token);
  if (!user) throw error(403, "Token invalide");

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw error(403, "Accès refusé");

  const stream = new ReadableStream({
    start(controller) {
      function push() {
        const roomGames = Object.entries(globalThis.__zik_roomGames ?? {}).map(
          ([roomId, g]) => ({
            roomId,
            players: Object.keys(g.socketToName ?? {}).length,
            round: g.currentRound ?? 0,
            maxRounds: g.maxRounds ?? 0,
            state: g.state ?? "unknown",
          }),
        );

        const salonRooms = Object.entries(
          globalThis.__zik_salonRooms ?? {},
        ).map(([code, s]) => ({
          code,
          host: s.hostName ?? "?",
          players: (s.players ?? []).length,
          state: s.game?.state ?? s.state ?? "lobby",
        }));

        const totalConnected =
          roomGames.reduce((sum, r) => sum + r.players, 0) +
          salonRooms.reduce((sum, s) => sum + s.players, 0);

        const payload = JSON.stringify({
          roomGames,
          salonRooms,
          totalConnected,
          ts: Date.now(),
        });
        controller.enqueue(`data: ${payload}\n\n`);
      }

      push();
      const interval = setInterval(push, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Vérifier** : `npm run lint` (0 errors).

- [ ] **Tester manuellement** en local : ouvrir `http://localhost:5173/api/admin/live?token=INVALID` → doit retourner 403. Avec un token valide admin → flux SSE visible dans le navigateur (onglet Network → EventStream).

- [ ] **Commit**

```bash
git add src/routes/(site)/api/admin/live/+server.js
git commit -m "feat(admin): SSE endpoint /api/admin/live"
```

---

## Task 4 : Mise à jour layout admin (nav + JWT context)

**Files:**

- Modify: `src/routes/(admin)/+layout.svelte`
- Modify: `src/routes/(admin)/admin/+page.server.js`

- [ ] **Modifier `+layout.svelte`** — ajouter `setContext`, les nouveaux liens nav, et le style scan-lines

```svelte
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
```

- [ ] **Modifier `src/routes/(admin)/admin/+page.server.js`** — redirect vers dashboard

```js
import { redirect } from "@sveltejs/kit";

export function load() {
  redirect(303, "/admin/dashboard");
}
```

- [ ] **Vérifier** : `npm run lint` (0 errors). Aller sur `/admin` en local → redirige vers `/admin/dashboard`. Nav affiche les 3 liens.

- [ ] **Commit**

```bash
git add src/routes/(admin)/+layout.svelte src/routes/(admin)/admin/+page.server.js
git commit -m "feat(admin): layout darknet + nav dashboard/users/reports + JWT context"
```

---

## Task 5 : Dashboard — server (stats)

**Files:**

- Create: `src/routes/(admin)/admin/dashboard/+page.server.js`

- [ ] **Créer le fichier**

```js
import { getAdminClient } from "$lib/server/config.js";

export async function load() {
  const sb = getAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { count: totalUsers },
    { count: gamesToday },
    { count: publicRooms },
    { count: pendingReports },
    { count: officialPlaylists },
    activeUsersRes,
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb
      .from("games")
      .select("*", { count: "exact", head: true })
      .gte("started_at", today.toISOString()),
    sb
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("is_public", true),
    sb
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    sb
      .from("custom_playlists")
      .select("*", { count: "exact", head: true })
      .eq("is_official", true),
    sb
      .from("game_players")
      .select("user_id", { count: "exact", head: true })
      .gte("games.started_at", sevenDaysAgo)
      .not("user_id", "is", null),
  ]);

  const uptimeSeconds = Math.floor(process.uptime());
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;
  const uptime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return {
    stats: {
      totalUsers: totalUsers ?? 0,
      gamesToday: gamesToday ?? 0,
      publicRooms: publicRooms ?? 0,
      pendingReports: pendingReports ?? 0,
      officialPlaylists: officialPlaylists ?? 0,
      activeUsers7d: activeUsersRes.count ?? 0,
      uptime,
    },
  };
}
```

- [ ] **Vérifier** : `npm run lint` (0 errors).

- [ ] **Commit**

```bash
git add src/routes/(admin)/admin/dashboard/+page.server.js
git commit -m "feat(admin): dashboard stats server load"
```

---

## Task 6 : Dashboard — UI darknet + SSE client

**Files:**

- Create: `src/routes/(admin)/admin/dashboard/+page.svelte`

- [ ] **Créer le fichier**

```svelte
<script>
  import { onMount, getContext } from 'svelte';

  let { data } = $props();

  let live = $state(null);
  let connected = $state(false);
  let retryDelay = 1000;
  let es;

  const adminCtx = getContext('adminToken');

  onMount(() => {
    connect();
    return () => es?.close();
  });

  function connect() {
    const token = adminCtx?.token;
    if (!token) return;
    es = new EventSource(`/api/admin/live?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      live = JSON.parse(e.data);
      connected = true;
      retryDelay = 1000;
    };
    es.onerror = () => {
      connected = false;
      es?.close();
      setTimeout(() => connect(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
  }

  const { stats } = data;

  const STAT_CARDS = [
    { label: 'TOTAL_USERS',       value: () => stats.totalUsers,        color: '#00ff41' },
    { label: 'ACTIVE_7D',         value: () => stats.activeUsers7d,     color: '#00ff41' },
    { label: 'GAMES_TODAY',       value: () => stats.gamesToday,        color: '#ffb300' },
    { label: 'PUBLIC_ROOMS',      value: () => stats.publicRooms,       color: '#ffb300' },
    { label: 'REPORTS_PENDING',   value: () => stats.pendingReports,    color: stats.pendingReports > 0 ? '#ff4444' : '#00ff41' },
    { label: 'SERVER_UPTIME',     value: () => stats.uptime,            color: '#00bfff' },
  ];
</script>

<div class="dash">
  <div class="dash-header">
    <span class="dash-title">// CONTROL_CENTER</span>
    <span class="dash-sub">ZIK ADMIN v2 — {new Date().toLocaleDateString('fr-FR')}</span>
  </div>

  <!-- Stats grid -->
  <div class="stats-grid">
    {#each STAT_CARDS as card}
      <div class="stat-card">
        <div class="stat-label">// {card.label}</div>
        <div class="stat-value" style="color:{card.color}">{card.value()}</div>
      </div>
    {/each}
  </div>

  <!-- Live panel -->
  <div class="live-section">
    <div class="live-header">
      <span class="live-title">// LIVE_FEED</span>
      <span class="live-indicator" class:connected>
        {connected ? '● CONNECTED' : '○ RECONNECTING...'}
      </span>
    </div>

    {#if live}
      <div class="live-grid">
        <!-- Room Games -->
        <div class="live-panel">
          <div class="panel-title">ROOM_GAMES [{live.roomGames.length}]</div>
          {#if live.roomGames.length === 0}
            <div class="panel-empty">-- NO ACTIVE GAMES --</div>
          {:else}
            {#each live.roomGames as g (g.roomId)}
              <div class="live-row">
                <span class="live-room">{g.roomId}</span>
                <span class="live-players">{g.players}px</span>
                <span class="live-round">round {g.round}/{g.maxRounds}</span>
                <span class="live-state">[{g.state}]</span>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Salon Rooms -->
        <div class="live-panel">
          <div class="panel-title">SALON_ROOMS [{live.salonRooms.length}]</div>
          {#if live.salonRooms.length === 0}
            <div class="panel-empty">-- NO ACTIVE SALONS --</div>
          {:else}
            {#each live.salonRooms as s (s.code)}
              <div class="live-row">
                <span class="live-room">{s.code}</span>
                <span class="live-players">{s.players}px</span>
                <span class="live-host">host:{s.host}</span>
                <span class="live-state">[{s.state}]</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="live-total">
        TOTAL_CONNECTED: <span style="color:#ffb300">{live.totalConnected}</span>
        &nbsp;|&nbsp; TS: {new Date(live.ts).toLocaleTimeString('fr-FR')}
      </div>
    {:else}
      <div class="panel-empty">// WAITING FOR DATA STREAM...</div>
    {/if}
  </div>
</div>

<style>
.dash { display: flex; flex-direction: column; gap: 32px; }

.dash-header { display: flex; align-items: baseline; gap: 16px; }
.dash-title { font-size: 1.2rem; font-weight: 700; color: #00ff41; letter-spacing: 0.1em; }
.dash-sub { font-size: 0.72rem; color: rgba(0,255,65,0.4); }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.stat-card {
  background: rgba(0,255,65,0.03);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 4px;
  padding: 16px 20px;
}
.stat-label { font-size: 0.65rem; color: rgba(0,255,65,0.4); letter-spacing: 0.12em; margin-bottom: 10px; }
.stat-value { font-size: 2rem; font-weight: 700; letter-spacing: -1px; }

.live-section {
  background: rgba(0,255,65,0.02);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 4px;
  padding: 20px;
}
.live-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.live-title { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; }
.live-indicator { font-size: 0.7rem; color: #ff4444; letter-spacing: 0.08em; }
.live-indicator.connected { color: #00ff41; }

.live-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
.live-panel { border: 1px solid rgba(0,255,65,0.1); border-radius: 4px; padding: 12px; }
.panel-title { font-size: 0.68rem; color: #ffb300; letter-spacing: 0.1em; margin-bottom: 10px; }
.panel-empty { font-size: 0.72rem; color: rgba(0,255,65,0.25); text-align: center; padding: 12px 0; }

.live-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  padding: 5px 0;
  border-bottom: 1px solid rgba(0,255,65,0.06);
}
.live-row:last-child { border-bottom: none; }
.live-room { color: #00ff41; font-weight: 700; min-width: 60px; }
.live-players { color: #ffb300; }
.live-round, .live-host { color: rgba(0,255,65,0.5); flex: 1; }
.live-state { color: rgba(0,255,65,0.3); font-size: 0.68rem; }

.live-total { font-size: 0.7rem; color: rgba(0,255,65,0.4); margin-top: 8px; letter-spacing: 0.05em; }

@media (max-width: 700px) {
  .live-grid { grid-template-columns: 1fr; }
}
</style>
```

- [ ] **Vérifier manuellement** : aller sur `/admin/dashboard` → stats s'affichent, bloc live apparaît avec indicateur vert pulsant, données se rafraîchissent.

- [ ] **Commit**

```bash
git add src/routes/(admin)/admin/dashboard/
git commit -m "feat(admin): dashboard UI darknet + SSE live feed"
```

---

## Task 7 : Users — liste paginée

**Files:**

- Create: `src/routes/(admin)/admin/users/+page.server.js`
- Create: `src/routes/(admin)/admin/users/+page.svelte`

- [ ] **Créer `+page.server.js`**

```js
import { getAdminClient } from "$lib/server/config.js";

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sort = url.searchParams.get("sort") || "elo";
  const order = url.searchParams.get("order") || "desc";
  const PAGE_SIZE = 50;

  let query = sb
    .from("profiles")
    .select(
      "id, username, avatar_url, role, xp, level, elo, games_played, created_at, is_private",
      { count: "exact" },
    )
    .order(sort, { ascending: order === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("username", `%${q}%`);

  const { data: users, count, error } = await query;

  // Note : le ban status n'est pas affiché dans la liste (perf — N requêtes auth.admin)
  // Il est visible sur la fiche individuelle /admin/users/[id]

  return {
    users: users || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    sort,
    order,
    error: error?.message || null,
  };
}
```

- [ ] **Créer `+page.svelte`**

```svelte
<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  let { data } = $props();

  function setParam(key, value) {
    const p = new SvelteURLSearchParams(page.url.searchParams);
    if (value) p.set(key, value); else p.delete(key);
    if (key !== 'page') p.set('page', '1');
    goto(`?${p.toString()}`);
  }

  let searchInput = $state(data.q);
  let searchTimer;
  function onSearch(e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setParam('q', e.target.value), 300);
  }

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }
</script>

<div class="users-page">
  <div class="users-header">
    <span class="page-title">// USER_DATABASE</span>
    <span class="page-sub">{data.total} enregistrements</span>
  </div>

  <div class="users-toolbar">
    <input
      class="search-input"
      type="text"
      placeholder="> SEARCH_USERNAME..."
      value={searchInput}
      oninput={onSearch}
    >
    <div class="sort-btns">
      {#each [['elo','ELO'],['level','LVL'],['games_played','GAMES'],['created_at','DATE']] as [key, label]}
        <button
          class="sort-btn"
          class:active={data.sort === key}
          onclick={() => setParam('sort', key)}
        >{label}</button>
      {/each}
    </div>
  </div>

  {#if data.error}
    <div class="err">[ERROR] {data.error}</div>
  {:else}
    <div class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>USER</th>
            <th>ROLE</th>
            <th>ELO</th>
            <th>LVL</th>
            <th>GAMES</th>
            <th>JOINED</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.users as u (u.id)}
            <tr class:super={u.role === 'super_admin'}>
              <td class="td-user">
                <img src={u.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${u.username}`} alt="" width="24" height="24" class="u-avatar">
                <span class="u-name">{u.username}</span>
              </td>
              <td><span class="role-badge role-{u.role}">{u.role === 'super_admin' ? 'ROOT' : 'USER'}</span></td>
              <td class="td-num">{u.elo}</td>
              <td class="td-num">{u.level}</td>
              <td class="td-num">{u.games_played}</td>
              <td class="td-date">{fmt(u.created_at)}</td>
              <td><a href="/admin/users/{u.id}" class="btn-view">OPEN →</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <button disabled={data.page <= 1} onclick={() => setParam('page', String(data.page - 1))}>◀ PREV</button>
        <span>{data.page} / {totalPages}</span>
        <button disabled={data.page >= totalPages} onclick={() => setParam('page', String(data.page + 1))}>NEXT ▶</button>
      </div>
    {/if}
  {/if}
</div>

<style>
.users-page { display: flex; flex-direction: column; gap: 20px; }
.users-header { display: flex; align-items: baseline; gap: 16px; }
.page-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; }
.page-sub { font-size: 0.72rem; color: rgba(0,255,65,0.4); }

.users-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 8px 14px;
  outline: none;
  min-width: 240px;
}
.search-input::placeholder { color: rgba(0,255,65,0.25); }
.search-input:focus { border-color: rgba(0,255,65,0.5); }

.sort-btns { display: flex; gap: 4px; }
.sort-btn {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  color: rgba(0,255,65,0.4);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.1s;
}
.sort-btn:hover, .sort-btn.active { background: rgba(0,255,65,0.1); color: #00ff41; border-color: rgba(0,255,65,0.4); }

.users-table-wrap { overflow-x: auto; }
.users-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.users-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
}
.users-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
}
.users-table tr:hover td { background: rgba(0,255,65,0.03); }
.users-table tr.super td { color: #ffb300; }

.td-user { display: flex; align-items: center; gap: 8px; }
.u-avatar { border-radius: 3px; flex-shrink: 0; }
.u-name { font-weight: 600; }
.td-num { font-variant-numeric: tabular-nums; }
.td-date { color: rgba(0,255,65,0.35); font-size: 0.72rem; }

.role-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 7px;
  border-radius: 2px;
}
.role-badge.role-super_admin { background: rgba(255,179,0,0.15); color: #ffb300; border: 1px solid rgba(255,179,0,0.3); }
.role-badge.role-user { background: rgba(0,255,65,0.08); color: rgba(0,255,65,0.5); border: 1px solid rgba(0,255,65,0.15); }

.btn-view {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(0,255,65,0.4);
  letter-spacing: 0.05em;
  transition: color 0.1s;
}
.btn-view:hover { color: #00ff41; }

.pagination { display: flex; align-items: center; gap: 16px; font-size: 0.75rem; }
.pagination button {
  background: rgba(0,255,65,0.06);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.72rem;
  padding: 6px 12px;
  cursor: pointer;
}
.pagination button:disabled { opacity: 0.25; cursor: not-allowed; }

.err { color: #ff4444; font-size: 0.82rem; }
</style>
```

- [ ] **Vérifier manuellement** : `/admin/users` → liste s'affiche, recherche fonctionne, tri fonctionne, lien OPEN → mène à `/admin/users/[id]` (404 pour l'instant, normal).

- [ ] **Commit**

```bash
git add src/routes/(admin)/admin/users/
git commit -m "feat(admin): users list — tableau paginé + recherche + tri"
```

---

## Task 8 : User detail + toutes les actions

**Files:**

- Create: `src/routes/(admin)/admin/users/[id]/+page.server.js`
- Create: `src/routes/(admin)/admin/users/[id]/+page.svelte`

- [ ] **Créer `+page.server.js`**

```js
import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

export async function load({ params }) {
  const sb = getAdminClient();
  const { id } = params;

  const [profileRes, authUserRes, gamesRes, reportsRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).single(),
    sb.auth.admin.getUserById(id),
    sb
      .from("game_players")
      .select(
        "score, rank, is_guest, games(id, room_id, started_at, ended_at, rounds)",
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("reports")
      .select("*")
      .or(`reporter_id.eq.${id},reported_user_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profileRes.error || !profileRes.data)
    throw error(404, "User introuvable");

  const authUser = authUserRes.data?.user;
  const isBanned = authUser?.banned_until
    ? new Date(authUser.banned_until) > new Date()
    : false;

  return {
    profile: profileRes.data,
    isBanned,
    bannedUntil: authUser?.banned_until ?? null,
    games: gamesRes.data ?? [],
    reports: reportsRes.data ?? [],
  };
}

export const actions = {
  ban: async ({ request, params }) => {
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb.auth.admin.updateUserById(params.id, { ban_duration: "87600h" });
    await logAdminAction(adminUser.id, "ban_user", params.id, "user", {
      duration: "87600h",
    });
    return { success: true };
  },

  unban: async ({ request, params }) => {
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb.auth.admin.updateUserById(params.id, { ban_duration: "none" });
    await logAdminAction(adminUser.id, "unban_user", params.id, "user", {});
    return { success: true };
  },

  editStats: async ({ request, params }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const sb = getAdminClient();
    const xp = parseInt(formData.get("xp")) || 0;
    const elo = parseInt(formData.get("elo")) || 1000;
    const level = parseInt(formData.get("level")) || 1;
    await sb.from("profiles").update({ xp, elo, level }).eq("id", params.id);
    await logAdminAction(adminUser.id, "edit_stats", params.id, "user", {
      xp,
      elo,
      level,
    });
    return { success: true };
  },

  editUsername: async ({ request, params }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const sb = getAdminClient();
    const username = formData.get("username")?.trim();
    if (!username || username.length < 3)
      return { success: false, error: "Username invalide" };
    const { error: err } = await sb
      .from("profiles")
      .update({ username })
      .eq("id", params.id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_username", params.id, "user", {
      username,
    });
    return { success: true };
  },

  resetStats: async ({ request, params }) => {
    const { adminUser } = await requireAdmin(request);
    const sb = getAdminClient();
    await sb
      .from("profiles")
      .update({
        xp: 0,
        elo: 1000,
        level: 1,
        games_played: 0,
        total_score: 0,
      })
      .eq("id", params.id);
    await logAdminAction(adminUser.id, "reset_stats", params.id, "user", {});
    return { success: true };
  },

  setRole: async ({ request, params }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const role = formData.get("role");
    if (!["user", "super_admin"].includes(role)) return { success: false };
    const sb = getAdminClient();
    await sb.from("profiles").update({ role }).eq("id", params.id);
    await logAdminAction(adminUser.id, "set_role", params.id, "user", { role });
    return { success: true };
  },

  deleteUser: async ({ request, params }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const confirm = formData.get("confirm_username")?.trim();
    const sb = getAdminClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("username")
      .eq("id", params.id)
      .single();
    if (confirm !== profile?.username)
      return {
        success: false,
        error: "Username incorrect — suppression annulée",
      };
    await logAdminAction(adminUser.id, "delete_user", params.id, "user", {
      username: profile.username,
    });
    await sb.auth.admin.deleteUser(params.id);
    return { success: true, deleted: true };
  },
};
```

- [ ] **Créer `+page.svelte`**

```svelte
<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';

  let { data, form } = $props();

  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  const { profile, isBanned, games, reports } = data;

  let confirmUsername = $state('');
  let showDeleteModal = $state(false);

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // Après delete réussi, redirect vers la liste
  $effect(() => {
    if (form?.deleted) goto('/admin/users');
  });
</script>

<div class="user-page">
  <a href="/admin/users" class="back">← BACK_TO_LIST</a>

  <!-- Header profil -->
  <div class="user-header">
    <img src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${profile.username}`} alt="" class="user-avatar">
    <div class="user-info">
      <div class="user-name">{profile.username}</div>
      <div class="user-meta">
        <span class="role-tag role-{profile.role}">{profile.role === 'super_admin' ? 'ROOT' : 'USER'}</span>
        {#if isBanned}<span class="ban-tag">⚠ BANNED</span>{/if}
        <span class="user-id">ID: {profile.id}</span>
      </div>
    </div>
    <div class="user-stats">
      <div class="stat"><span class="sl">ELO</span><span class="sv">{profile.elo}</span></div>
      <div class="stat"><span class="sl">XP</span><span class="sv">{profile.xp}</span></div>
      <div class="stat"><span class="sl">LVL</span><span class="sv">{profile.level}</span></div>
      <div class="stat"><span class="sl">GAMES</span><span class="sv">{profile.games_played}</span></div>
    </div>
  </div>

  {#if form && !form.success}
    <div class="alert-err">[ERROR] {form.error ?? 'Action échouée'}</div>
  {/if}
  {#if form?.success && !form?.deleted}
    <div class="alert-ok">[OK] Action appliquée.</div>
  {/if}

  <div class="actions-grid">

    <!-- BAN / UNBAN -->
    <div class="action-card">
      <div class="action-title">// BAN_CONTROL</div>
      {#if isBanned}
        <form method="POST" action="?/unban" use:enhance>
          <input type="hidden" name="_token" value={token}>
          <button class="btn-action btn-green">UNBAN USER</button>
        </form>
      {:else}
        <form method="POST" action="?/ban" use:enhance>
          <input type="hidden" name="_token" value={token}>
          <button class="btn-action btn-red">BAN USER (10yr)</button>
        </form>
      {/if}
    </div>

    <!-- EDIT STATS -->
    <div class="action-card">
      <div class="action-title">// EDIT_STATS</div>
      <form method="POST" action="?/editStats" use:enhance class="form-inline">
        <input type="hidden" name="_token" value={token}>
        <label>XP<input type="number" name="xp" value={profile.xp} min="0"></label>
        <label>ELO<input type="number" name="elo" value={profile.elo} min="0"></label>
        <label>LVL<input type="number" name="level" value={profile.level} min="1"></label>
        <button class="btn-action btn-amber">APPLY</button>
      </form>
    </div>

    <!-- EDIT USERNAME -->
    <div class="action-card">
      <div class="action-title">// EDIT_USERNAME</div>
      <form method="POST" action="?/editUsername" use:enhance class="form-inline">
        <input type="hidden" name="_token" value={token}>
        <label>New username<input type="text" name="username" value={profile.username} minlength="3" maxlength="20"></label>
        <button class="btn-action btn-amber">RENAME</button>
      </form>
    </div>

    <!-- RESET STATS -->
    <div class="action-card">
      <div class="action-title">// RESET_STATS</div>
      <p class="action-desc">Remet XP=0, ELO=1000, LVL=1, games=0, score=0</p>
      <form method="POST" action="?/resetStats" use:enhance>
        <input type="hidden" name="_token" value={token}>
        <button class="btn-action btn-red" onclick="return confirm('Reset toutes les stats ?')">RESET ALL STATS</button>
      </form>
    </div>

    <!-- SET ROLE -->
    <div class="action-card">
      <div class="action-title">// SET_ROLE</div>
      <form method="POST" action="?/setRole" use:enhance class="form-inline">
        <input type="hidden" name="_token" value={token}>
        <select name="role" class="adm-select">
          <option value="user" selected={profile.role === 'user'}>USER</option>
          <option value="super_admin" selected={profile.role === 'super_admin'}>ROOT (super_admin)</option>
        </select>
        <button class="btn-action btn-amber">SET</button>
      </form>
    </div>

    <!-- DELETE -->
    <div class="action-card action-card--danger">
      <div class="action-title">// TERMINATE_ACCOUNT</div>
      <p class="action-desc">Suppression définitive et irréversible.</p>
      <button class="btn-action btn-red" onclick={() => showDeleteModal = true}>DELETE ACCOUNT</button>
    </div>

  </div>

  <!-- Modal suppression -->
  {#if showDeleteModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showDeleteModal = false; }}>
    <div class="modal">
      <div class="modal-title">// CONFIRM_TERMINATION</div>
      <p class="modal-desc">Tape le username <strong>{profile.username}</strong> pour confirmer.</p>
      <form method="POST" action="?/deleteUser" use:enhance>
        <input type="hidden" name="_token" value={token}>
        <input type="text" name="confirm_username" bind:value={confirmUsername} class="confirm-input" placeholder={profile.username} autocomplete="off">
        <div class="modal-btns">
          <button type="button" class="btn-action btn-ghost" onclick={() => showDeleteModal = false}>CANCEL</button>
          <button class="btn-action btn-red" disabled={confirmUsername !== profile.username}>CONFIRM DELETE</button>
        </div>
      </form>
    </div>
  </div>
  {/if}

  <!-- Historique parties -->
  <div class="section">
    <div class="section-title">// GAME_HISTORY [{games.length}]</div>
    {#if games.length === 0}
      <div class="empty">-- NO GAMES --</div>
    {:else}
      <div class="history-list">
        {#each games as g (g.games?.id)}
          <div class="history-row">
            <span class="hr-room">{g.games?.room_id ?? '?'}</span>
            <span class="hr-score">score: {g.score}</span>
            <span class="hr-rank">{g.rank ? `#${g.rank}` : '—'}</span>
            <span class="hr-date">{fmt(g.games?.started_at)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Reports -->
  <div class="section">
    <div class="section-title">// REPORTS [{reports.length}]</div>
    {#if reports.length === 0}
      <div class="empty">-- NO REPORTS --</div>
    {:else}
      <div class="history-list">
        {#each reports as r (r.id)}
          <div class="history-row">
            <span class="hr-room">{r.type}</span>
            <span class="hr-score">{r.status}</span>
            <span class="hr-rank">{r.reporter_id === profile.id ? 'reporter' : 'reported'}</span>
            <span class="hr-date">{fmt(r.created_at)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
.user-page { display: flex; flex-direction: column; gap: 28px; }

.back { font-size: 0.72rem; color: rgba(0,255,65,0.4); letter-spacing: 0.05em; transition: color 0.1s; }
.back:hover { color: #00ff41; }

.user-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: rgba(0,255,65,0.03);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 4px;
  flex-wrap: wrap;
}
.user-avatar { width: 56px; height: 56px; border-radius: 4px; flex-shrink: 0; }
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 1.3rem; font-weight: 700; color: #00ff41; }
.user-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.role-tag { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; padding: 2px 7px; border-radius: 2px; }
.role-tag.role-super_admin { background: rgba(255,179,0,0.15); color: #ffb300; border: 1px solid rgba(255,179,0,0.3); }
.role-tag.role-user { background: rgba(0,255,65,0.08); color: rgba(0,255,65,0.5); border: 1px solid rgba(0,255,65,0.15); }
.ban-tag { font-size: 0.62rem; font-weight: 700; background: rgba(255,68,68,0.15); color: #ff4444; border: 1px solid rgba(255,68,68,0.3); padding: 2px 7px; border-radius: 2px; }
.user-id { font-size: 0.62rem; color: rgba(0,255,65,0.25); }

.user-stats { display: flex; gap: 16px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.sl { font-size: 0.6rem; color: rgba(0,255,65,0.35); letter-spacing: 0.1em; }
.sv { font-size: 1.1rem; font-weight: 700; color: #ffb300; }

.alert-err { background: rgba(255,68,68,0.08); border: 1px solid rgba(255,68,68,0.2); color: #ff4444; padding: 10px 14px; border-radius: 3px; font-size: 0.8rem; }
.alert-ok  { background: rgba(0,255,65,0.06); border: 1px solid rgba(0,255,65,0.2); color: #00ff41; padding: 10px 14px; border-radius: 3px; font-size: 0.8rem; }

.actions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.action-card {
  background: rgba(0,255,65,0.02);
  border: 1px solid rgba(0,255,65,0.12);
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.action-card--danger { border-color: rgba(255,68,68,0.2); }
.action-title { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(0,255,65,0.5); }
.action-desc { font-size: 0.73rem; color: rgba(0,255,65,0.35); line-height: 1.4; }

.form-inline { display: flex; flex-direction: column; gap: 8px; }
.form-inline label { display: flex; flex-direction: column; gap: 4px; font-size: 0.68rem; color: rgba(0,255,65,0.4); letter-spacing: 0.08em; }
.form-inline input, .adm-select {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.8rem;
  padding: 6px 10px;
  outline: none;
}
.adm-select { cursor: pointer; }
.adm-select option { background: #0a0a0f; }

.btn-action {
  border: none;
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 8px 16px;
  cursor: pointer;
  transition: opacity 0.1s;
  align-self: flex-start;
}
.btn-action:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-action:hover:not(:disabled) { opacity: 0.8; }
.btn-red   { background: rgba(255,68,68,0.15); color: #ff4444; border: 1px solid rgba(255,68,68,0.3); }
.btn-green { background: rgba(0,255,65,0.12); color: #00ff41; border: 1px solid rgba(0,255,65,0.3); }
.btn-amber { background: rgba(255,179,0,0.12); color: #ffb300; border: 1px solid rgba(255,179,0,0.3); }
.btn-ghost { background: transparent; color: rgba(0,255,65,0.4); border: 1px solid rgba(0,255,65,0.2); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px;
}
.modal {
  background: #0d0d15; border: 1px solid rgba(255,68,68,0.3);
  border-radius: 4px; padding: 28px; max-width: 420px; width: 100%;
  display: flex; flex-direction: column; gap: 14px;
}
.modal-title { font-size: 0.82rem; font-weight: 700; letter-spacing: 0.1em; color: #ff4444; }
.modal-desc { font-size: 0.8rem; color: rgba(0,255,65,0.6); line-height: 1.5; }
.modal-desc strong { color: #ffb300; }
.confirm-input {
  background: rgba(255,68,68,0.04);
  border: 1px solid rgba(255,68,68,0.2);
  border-radius: 3px;
  color: #ff4444;
  font-family: inherit;
  font-size: 0.85rem;
  padding: 8px 12px;
  outline: none;
  width: 100%;
}
.modal-btns { display: flex; gap: 8px; }

/* Sections historique */
.section { display: flex; flex-direction: column; gap: 10px; }
.section-title { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(0,255,65,0.5); }
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-row {
  display: flex; align-items: center; gap: 16px;
  font-size: 0.75rem; padding: 7px 10px;
  background: rgba(0,255,65,0.02);
  border: 1px solid rgba(0,255,65,0.06);
  border-radius: 3px;
}
.hr-room { color: #00ff41; font-weight: 600; min-width: 80px; }
.hr-score { color: #ffb300; }
.hr-rank { color: rgba(0,255,65,0.5); min-width: 30px; }
.hr-date { color: rgba(0,255,65,0.3); font-size: 0.7rem; margin-left: auto; }
.empty { font-size: 0.72rem; color: rgba(0,255,65,0.2); padding: 12px 0; }
</style>
```

- [ ] **Vérifier manuellement** : ouvrir la fiche d'un user → stats visibles, toutes les actions présentes. Tester ban/unban, edit stats, reset, edit username. Tester la suppression avec mauvais username → erreur. Tester avec bon username → redirect vers liste.

- [ ] **Lint final**

```bash
npm run lint
```

0 erreurs attendues.

- [ ] **Commit final**

```bash
git add src/routes/(admin)/admin/users/
git commit -m "feat(admin): fiche user + ban/unban/edit/reset/role/delete + audit log"
```

---

## Fin de Phase 1 — Vérifications globales

- [ ] Aller sur `/admin` → redirige vers `/admin/dashboard`
- [ ] Dashboard : stats chargées + live SSE connecté (indicateur vert)
- [ ] `/admin/users` : liste + recherche + pagination fonctionnelles
- [ ] `/admin/users/[id]` : toutes les actions fonctionnent + audit_log rempli après chaque action
- [ ] Table `admin_audit_log` dans Supabase : vérifier que les lignes s'insèrent correctement
- [ ] Tentative de POST direct sur une action sans token → 403
- [ ] `npm run lint` → 0 erreurs

---

## Avancement Phase 1

- [x] Spec approuvée
- [ ] Task 1 — Migration BDD
- [ ] Task 2 — requireAdmin / logAdminAction
- [ ] Task 3 — SSE endpoint
- [ ] Task 4 — Layout admin
- [ ] Task 5 — Dashboard server
- [ ] Task 6 — Dashboard UI
- [ ] Task 7 — Users list
- [ ] Task 8 — User detail + actions
