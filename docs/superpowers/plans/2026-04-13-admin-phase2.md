# ZIK Admin Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la gestion des Rooms et des Playlists (+ tracks) dans l'espace admin ZIK.

**Architecture:** Rooms = liste server-side avec actions inline (toggle flags, modal édition, modal suppression). Playlists = liste + fiche détail `/admin/playlists/[id]` pour gérer les tracks (voir, supprimer, réordonner ▲▼). Toutes les mutations passent par `requireAdmin()` + `logAdminAction()`. Style terminal darknet identique à phase 1.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Supabase JS SDK (service key via `getAdminClient()`), `use:enhance` SvelteKit forms, CSS pur (même tokens que phase 1).

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `src/routes/(admin)/+layout.svelte` | Modifier | Ajouter liens ◧ Rooms + ◫ Playlists dans la nav |
| `src/routes/(admin)/admin/rooms/+page.server.js` | Créer | load rooms paginé + actions toggleFlag / editRoom / deleteRoom |
| `src/routes/(admin)/admin/rooms/+page.svelte` | Créer | Tableau rooms + modals inline edit + delete |
| `src/routes/(admin)/admin/playlists/+page.server.js` | Créer | load playlists paginé + actions toggleFlag / editPlaylist / deletePlaylist |
| `src/routes/(admin)/admin/playlists/+page.svelte` | Créer | Tableau playlists + modals inline |
| `src/routes/(admin)/admin/playlists/[id]/+page.server.js` | Créer | load fiche playlist + tracks + actions deleteTrack / reorderTrack / deletePlaylist |
| `src/routes/(admin)/admin/playlists/[id]/+page.svelte` | Créer | Fiche playlist + tableau tracks avec ▲▼ + suppression |

---

## Task 1 : Nav — ajouter liens Rooms + Playlists

**Files:**
- Modify: `src/routes/(admin)/+layout.svelte`

- [ ] **Ajouter les deux liens dans la nav**

Dans `+layout.svelte`, remplacer le bloc `.adm-nav-links` :

```svelte
<div class="adm-nav-links">
  <a href="/admin/dashboard" class="adm-nav-link">⬡ Dashboard</a>
  <a href="/admin/users"     class="adm-nav-link">◈ Users</a>
  <a href="/admin/reports"   class="adm-nav-link">◉ Reports</a>
  <a href="/admin/rooms"     class="adm-nav-link">◧ Rooms</a>
  <a href="/admin/playlists" class="adm-nav-link">◫ Playlists</a>
</div>
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/+layout.svelte
git commit -m "feat(admin): nav — liens Rooms + Playlists"
```

---

## Task 2 : Rooms — server (`/admin/rooms`)

**Files:**
- Create: `src/routes/(admin)/admin/rooms/+page.server.js`

- [ ] **Créer le fichier**

```js
import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const ALLOWED_SORT = ["last_active_at", "created_at", "name"];
const ALLOWED_FLAGS = ["is_official", "is_public"];
const PAGE_SIZE = 50;

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sortParam = url.searchParams.get("sort");
  const sort = ALLOWED_SORT.includes(sortParam) ? sortParam : "last_active_at";

  let query = sb
    .from("rooms")
    .select(
      "id, code, name, emoji, description, owner_id, is_public, is_official, auto_start, max_rounds, round_duration, break_duration, created_at, last_active_at, profiles!owner_id(username)",
      { count: "exact" },
    )
    .order(sort, { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data: rooms, count, error: err } = await query;

  return {
    rooms: rooms || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    sort,
    error: err?.message || null,
  };
}

export const actions = {
  toggleFlag: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const field = formData.get("field");
    const value = formData.get("value") === "true";
    if (!ALLOWED_FLAGS.includes(field)) throw error(400, "Champ invalide");
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("rooms")
      .update({ [field]: value })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "toggle_room_flag", id, "room", {
      field,
      value,
    });
    return { success: true };
  },

  editRoom: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const name = formData.get("name")?.trim();
    const emoji = formData.get("emoji")?.trim() || "🎵";
    const description = formData.get("description")?.trim() || null;
    const max_rounds = Math.min(
      50,
      Math.max(3, parseInt(formData.get("max_rounds"), 10) || 10),
    );
    const round_duration = Math.min(
      60,
      Math.max(10, parseInt(formData.get("round_duration"), 10) || 30),
    );
    const break_duration = Math.min(
      15,
      Math.max(3, parseInt(formData.get("break_duration"), 10) || 7),
    );
    const auto_start = formData.get("auto_start") === "on";
    if (!name || name.length < 1 || name.length > 60)
      return { success: false, error: "Nom invalide (1-60 chars)" };
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("rooms")
      .update({ name, emoji, description, max_rounds, round_duration, break_duration, auto_start })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_room", id, "room", {
      name,
      emoji,
      description,
      max_rounds,
      round_duration,
      break_duration,
      auto_start,
    });
    return { success: true };
  },

  deleteRoom: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const sb = getAdminClient();
    const { data: room } = await sb
      .from("rooms")
      .select("code, name")
      .eq("id", id)
      .single();
    const { error: err } = await sb.from("rooms").delete().eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_room", id, "room", {
      code: room?.code,
      name: room?.name,
    });
    return { success: true };
  },
};
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/rooms/+page.server.js
git commit -m "feat(admin): rooms — server load + actions"
```

---

## Task 3 : Rooms — UI (`/admin/rooms`)

**Files:**
- Create: `src/routes/(admin)/admin/rooms/+page.svelte`

- [ ] **Créer le fichier**

```svelte
<script>
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { getContext } from 'svelte';

  let { data, form } = $props();
  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  let editModal = $state(null);   // room object en cours d'édition
  let deleteModal = $state(null); // room object à supprimer

  function setParam(key, value) {
    const p = new SvelteURLSearchParams(page.url.searchParams);
    if (value) p.set(key, value); else p.delete(key);
    if (key !== 'page') p.set('page', '1');
    goto(`?${p.toString()}`);
  }

  let searchInput = $state(data.q);
  let searchTimer = $state(undefined);
  function onSearch(e) {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => setParam('q', val), 300);
  }
  $effect(() => () => clearTimeout(searchTimer));

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }

  function openEdit(room) {
    editModal = { ...room };
  }
  function closeEdit() { editModal = null; }
  function openDelete(room) { deleteModal = room; }
  function closeDelete() { deleteModal = null; }
</script>

<div class="rooms-page">
  <div class="page-header">
    <span class="page-title">// ROOM_DATABASE</span>
    <span class="page-sub">{data.total} enregistrements</span>
  </div>

  <div class="toolbar">
    <input
      class="search-input"
      type="text"
      placeholder="> SEARCH_NAME_OR_CODE..."
      value={searchInput}
      oninput={onSearch}
    />
    <div class="sort-btns">
      {#each [['last_active_at','ACTIVE'],['created_at','DATE'],['name','NAME']] as [key, label]}
        <button
          class="sort-btn"
          class:active={data.sort === key}
          onclick={() => setParam('sort', key)}
        >{label}</button>
      {/each}
    </div>
  </div>

  {#if form && !form.success}
    <div class="alert-err">[ERROR] {form.error ?? 'Action échouée'}</div>
  {/if}
  {#if form?.success}
    <div class="alert-ok">[OK] Action appliquée.</div>
  {/if}

  {#if data.error}
    <div class="alert-err">[ERROR] {data.error}</div>
  {:else}
    <div class="table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th>CODE</th>
            <th>NAME</th>
            <th>OWNER</th>
            <th>PUBLIC</th>
            <th>OFFICIAL</th>
            <th>ROUNDS</th>
            <th>LAST ACTIVE</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.rooms as r (r.id)}
            <tr>
              <td class="td-code">{r.emoji} {r.code}</td>
              <td>{r.name}</td>
              <td class="td-dim">{r.profiles?.username ?? '—'}</td>

              <!-- Toggle is_public -->
              <td>
                <form method="POST" action="?/toggleFlag" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="id" value={r.id}>
                  <input type="hidden" name="field" value="is_public">
                  <input type="hidden" name="value" value={String(!r.is_public)}>
                  <button class="flag-btn" class:on={r.is_public}>{r.is_public ? '●' : '○'}</button>
                </form>
              </td>

              <!-- Toggle is_official -->
              <td>
                <form method="POST" action="?/toggleFlag" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="id" value={r.id}>
                  <input type="hidden" name="field" value="is_official">
                  <input type="hidden" name="value" value={String(!r.is_official)}>
                  <button class="flag-btn flag-official" class:on={r.is_official}>{r.is_official ? '★' : '☆'}</button>
                </form>
              </td>

              <td class="td-dim">{r.max_rounds}r / {r.round_duration}s</td>
              <td class="td-dim">{fmt(r.last_active_at)}</td>

              <td class="td-actions">
                <button class="btn-edit" onclick={() => openEdit(r)}>EDIT</button>
                <button class="btn-del" onclick={() => openDelete(r)}>DEL</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <button disabled={data.page <= 1} onclick={() => setParam('page', String(data.page - 1))}>◀ PREV</button>
        <span>{data.page} / {totalPages}</span>
        <button disabled={data.page >= totalPages} onclick={() => setParam('page', String(data.page + 1))}>NEXT ▶</button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal edit -->
{#if editModal}
  <div class="modal-overlay" onclick={closeEdit} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// EDIT_ROOM — {editModal.code}</div>
      <form method="POST" action="?/editRoom" use:enhance={() => ({
        onResult: ({ result }) => { if (result.type === 'success') { closeEdit(); invalidateAll(); } }
      })}>
        <input type="hidden" name="_token" value={token}>
        <input type="hidden" name="id" value={editModal.id}>
        <label class="field-label">NAME
          <input class="field-input" type="text" name="name" value={editModal.name} maxlength="60" required>
        </label>
        <label class="field-label">EMOJI
          <input class="field-input" type="text" name="emoji" value={editModal.emoji} maxlength="4">
        </label>
        <label class="field-label">DESCRIPTION
          <input class="field-input" type="text" name="description" value={editModal.description ?? ''}>
        </label>
        <div class="field-row">
          <label class="field-label">MAX_ROUNDS
            <input class="field-input field-num" type="number" name="max_rounds" value={editModal.max_rounds} min="3" max="50">
          </label>
          <label class="field-label">ROUND_DURATION (s)
            <input class="field-input field-num" type="number" name="round_duration" value={editModal.round_duration} min="10" max="60">
          </label>
          <label class="field-label">BREAK_DURATION (s)
            <input class="field-input field-num" type="number" name="break_duration" value={editModal.break_duration} min="3" max="15">
          </label>
        </div>
        <label class="field-checkbox">
          <input type="checkbox" name="auto_start" checked={editModal.auto_start}>
          AUTO_START
        </label>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={closeEdit}>CANCEL</button>
          <button type="submit" class="btn-confirm">SAVE</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal delete -->
{#if deleteModal}
  <div class="modal-overlay" onclick={closeDelete} role="presentation">
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// DELETE_ROOM</div>
      <p class="modal-warn">Supprimer <strong>{deleteModal.name}</strong> ({deleteModal.code}) ?</p>
      <form method="POST" action="?/deleteRoom" use:enhance={() => ({
        onResult: ({ result }) => { if (result.type === 'success') { closeDelete(); invalidateAll(); } }
      })}>
        <input type="hidden" name="_token" value={token}>
        <input type="hidden" name="id" value={deleteModal.id}>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={closeDelete}>CANCEL</button>
          <button type="submit" class="btn-confirm btn-red">SUPPRIMER</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
.rooms-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: baseline; gap: 16px; }
.page-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; }
.page-sub { font-size: 0.72rem; color: rgba(0,255,65,0.4); }

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 8px 14px;
  outline: none;
  min-width: 280px;
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

.table-wrap { overflow-x: auto; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.adm-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
}
.adm-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
  vertical-align: middle;
}
.adm-table tr:hover td { background: rgba(0,255,65,0.03); }

.td-code { font-weight: 700; letter-spacing: 0.05em; }
.td-dim { color: rgba(0,255,65,0.4); font-size: 0.75rem; }
.td-actions { display: flex; gap: 6px; }

.flag-btn {
  background: transparent;
  border: none;
  color: rgba(0,255,65,0.3);
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.1s;
}
.flag-btn.on { color: #00ff41; }
.flag-btn.flag-official.on { color: #ffb300; }

.btn-edit, .btn-del {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: rgba(0,255,65,0.5);
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-edit:hover { color: #00ff41; border-color: rgba(0,255,65,0.5); }
.btn-del { border-color: rgba(255,68,68,0.2); color: rgba(255,68,68,0.5); }
.btn-del:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); }

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

.alert-err { color: #ff4444; font-size: 0.82rem; }
.alert-ok { color: #00ff41; font-size: 0.82rem; }

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #0d0d14;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 6px;
  padding: 28px;
  width: 520px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-sm { width: 360px; }
.modal-title { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.12em; color: #00ff41; }
.modal-warn { font-size: 0.82rem; color: rgba(0,255,65,0.7); }
.modal-warn strong { color: #ffb300; }

.field-label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.5);
  flex: 1;
}
.field-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 7px 10px;
  outline: none;
}
.field-input:focus { border-color: rgba(0,255,65,0.5); }
.field-num { width: 80px; }
.field-row { display: flex; gap: 12px; }
.field-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  color: rgba(0,255,65,0.6);
  cursor: pointer;
  letter-spacing: 0.08em;
}

.modal-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.btn-cancel, .btn-confirm {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 3px;
  color: rgba(0,255,65,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 7px 16px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-cancel:hover { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm:hover { background: rgba(0,255,65,0.08); }
.btn-confirm.btn-red { border-color: rgba(255,68,68,0.4); color: #ff4444; }
.btn-confirm.btn-red:hover { background: rgba(255,68,68,0.08); }
</style>
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/rooms/+page.svelte
git commit -m "feat(admin): rooms — UI tableau + modals edit/delete"
```

---

## Task 4 : Playlists — server (`/admin/playlists`)

**Files:**
- Create: `src/routes/(admin)/admin/playlists/+page.server.js`

- [ ] **Créer le fichier**

```js
import { error } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const ALLOWED_SORT = ["track_count", "created_at", "name"];
const ALLOWED_FLAGS = ["is_official", "is_public"];
const PAGE_SIZE = 50;

export async function load({ url }) {
  const sb = getAdminClient();
  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sortParam = url.searchParams.get("sort");
  const sort = ALLOWED_SORT.includes(sortParam) ? sortParam : "track_count";

  let query = sb
    .from("custom_playlists")
    .select(
      "id, name, emoji, owner_id, is_public, is_official, track_count, created_at, profiles!owner_id(username)",
      { count: "exact" },
    )
    .order(sort, { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: playlists, count, error: err } = await query;

  return {
    playlists: playlists || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    sort,
    error: err?.message || null,
  };
}

export const actions = {
  toggleFlag: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const field = formData.get("field");
    const value = formData.get("value") === "true";
    if (!ALLOWED_FLAGS.includes(field)) throw error(400, "Champ invalide");
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("custom_playlists")
      .update({ [field]: value })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "toggle_playlist_flag", id, "playlist", {
      field,
      value,
    });
    return { success: true };
  },

  editPlaylist: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const name = formData.get("name")?.trim();
    const emoji = formData.get("emoji")?.trim() || "🎵";
    if (!name || name.length < 1) return { success: false, error: "Nom invalide" };
    const sb = getAdminClient();
    const { error: err } = await sb
      .from("custom_playlists")
      .update({ name, emoji })
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "edit_playlist", id, "playlist", {
      name,
      emoji,
    });
    return { success: true };
  },

  deletePlaylist: async ({ request }) => {
    const { adminUser, formData } = await requireAdmin(request);
    const id = formData.get("id");
    const sb = getAdminClient();
    const { data: playlist } = await sb
      .from("custom_playlists")
      .select("name, track_count")
      .eq("id", id)
      .single();
    const { error: err } = await sb
      .from("custom_playlists")
      .delete()
      .eq("id", id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_playlist", id, "playlist", {
      name: playlist?.name,
      track_count: playlist?.track_count,
    });
    return { success: true };
  },
};
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/playlists/+page.server.js
git commit -m "feat(admin): playlists — server load + actions"
```

---

## Task 5 : Playlists — UI (`/admin/playlists`)

**Files:**
- Create: `src/routes/(admin)/admin/playlists/+page.svelte`

- [ ] **Créer le fichier**

```svelte
<script>
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { getContext } from 'svelte';

  let { data, form } = $props();
  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  let editModal = $state(null);
  let deleteModal = $state(null);

  function setParam(key, value) {
    const p = new SvelteURLSearchParams(page.url.searchParams);
    if (value) p.set(key, value); else p.delete(key);
    if (key !== 'page') p.set('page', '1');
    goto(`?${p.toString()}`);
  }

  let searchInput = $state(data.q);
  let searchTimer = $state(undefined);
  function onSearch(e) {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => setParam('q', val), 300);
  }
  $effect(() => () => clearTimeout(searchTimer));

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }
</script>

<div class="pl-page">
  <div class="page-header">
    <span class="page-title">// PLAYLIST_DATABASE</span>
    <span class="page-sub">{data.total} enregistrements</span>
  </div>

  <div class="toolbar">
    <input
      class="search-input"
      type="text"
      placeholder="> SEARCH_NAME..."
      value={searchInput}
      oninput={onSearch}
    />
    <div class="sort-btns">
      {#each [['track_count','TRACKS'],['created_at','DATE'],['name','NAME']] as [key, label]}
        <button
          class="sort-btn"
          class:active={data.sort === key}
          onclick={() => setParam('sort', key)}
        >{label}</button>
      {/each}
    </div>
  </div>

  {#if form && !form.success}
    <div class="alert-err">[ERROR] {form.error ?? 'Action échouée'}</div>
  {/if}
  {#if form?.success}
    <div class="alert-ok">[OK] Action appliquée.</div>
  {/if}

  {#if data.error}
    <div class="alert-err">[ERROR] {data.error}</div>
  {:else}
    <div class="table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th>NAME</th>
            <th>OWNER</th>
            <th>PUBLIC</th>
            <th>OFFICIAL</th>
            <th>TRACKS</th>
            <th>CREATED</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.playlists as pl (pl.id)}
            <tr>
              <td class="td-name">{pl.emoji} {pl.name}</td>
              <td class="td-dim">{pl.profiles?.username ?? '—'}</td>

              <!-- Toggle is_public -->
              <td>
                <form method="POST" action="?/toggleFlag" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="id" value={pl.id}>
                  <input type="hidden" name="field" value="is_public">
                  <input type="hidden" name="value" value={String(!pl.is_public)}>
                  <button class="flag-btn" class:on={pl.is_public}>{pl.is_public ? '●' : '○'}</button>
                </form>
              </td>

              <!-- Toggle is_official -->
              <td>
                <form method="POST" action="?/toggleFlag" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="id" value={pl.id}>
                  <input type="hidden" name="field" value="is_official">
                  <input type="hidden" name="value" value={String(!pl.is_official)}>
                  <button class="flag-btn flag-official" class:on={pl.is_official}>{pl.is_official ? '★' : '☆'}</button>
                </form>
              </td>

              <td class="td-num">{pl.track_count}</td>
              <td class="td-dim">{fmt(pl.created_at)}</td>

              <td class="td-actions">
                <a href="/admin/playlists/{pl.id}" class="btn-open">OPEN →</a>
                <button class="btn-edit" onclick={() => editModal = { ...pl }}>EDIT</button>
                <button class="btn-del" onclick={() => deleteModal = pl}>DEL</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <button disabled={data.page <= 1} onclick={() => setParam('page', String(data.page - 1))}>◀ PREV</button>
        <span>{data.page} / {totalPages}</span>
        <button disabled={data.page >= totalPages} onclick={() => setParam('page', String(data.page + 1))}>NEXT ▶</button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal edit -->
{#if editModal}
  <div class="modal-overlay" onclick={() => editModal = null} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// EDIT_PLAYLIST</div>
      <form method="POST" action="?/editPlaylist" use:enhance={() => ({
        onResult: ({ result }) => { if (result.type === 'success') { editModal = null; invalidateAll(); } }
      })}>
        <input type="hidden" name="_token" value={token}>
        <input type="hidden" name="id" value={editModal.id}>
        <label class="field-label">NAME
          <input class="field-input" type="text" name="name" value={editModal.name} required>
        </label>
        <label class="field-label">EMOJI
          <input class="field-input" type="text" name="emoji" value={editModal.emoji} maxlength="4">
        </label>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={() => editModal = null}>CANCEL</button>
          <button type="submit" class="btn-confirm">SAVE</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal delete -->
{#if deleteModal}
  <div class="modal-overlay" onclick={() => deleteModal = null} role="presentation">
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// DELETE_PLAYLIST</div>
      <p class="modal-warn">Supprimer <strong>{deleteModal.emoji} {deleteModal.name}</strong> ({deleteModal.track_count} tracks) ?</p>
      <form method="POST" action="?/deletePlaylist" use:enhance={() => ({
        onResult: ({ result }) => { if (result.type === 'success') { deleteModal = null; invalidateAll(); } }
      })}>
        <input type="hidden" name="_token" value={token}>
        <input type="hidden" name="id" value={deleteModal.id}>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={() => deleteModal = null}>CANCEL</button>
          <button type="submit" class="btn-confirm btn-red">SUPPRIMER</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
.pl-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: baseline; gap: 16px; }
.page-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; }
.page-sub { font-size: 0.72rem; color: rgba(0,255,65,0.4); }

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 8px 14px;
  outline: none;
  min-width: 260px;
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

.table-wrap { overflow-x: auto; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.adm-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
}
.adm-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
  vertical-align: middle;
}
.adm-table tr:hover td { background: rgba(0,255,65,0.03); }

.td-name { font-weight: 600; }
.td-dim { color: rgba(0,255,65,0.4); font-size: 0.75rem; }
.td-num { font-variant-numeric: tabular-nums; }
.td-actions { display: flex; gap: 6px; align-items: center; }

.flag-btn {
  background: transparent;
  border: none;
  color: rgba(0,255,65,0.3);
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.1s;
}
.flag-btn.on { color: #00ff41; }
.flag-btn.flag-official.on { color: #ffb300; }

.btn-open {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: rgba(0,255,65,0.4);
  transition: color 0.1s;
}
.btn-open:hover { color: #00ff41; }

.btn-edit, .btn-del {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: rgba(0,255,65,0.5);
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-edit:hover { color: #00ff41; border-color: rgba(0,255,65,0.5); }
.btn-del { border-color: rgba(255,68,68,0.2); color: rgba(255,68,68,0.5); }
.btn-del:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); }

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

.alert-err { color: #ff4444; font-size: 0.82rem; }
.alert-ok { color: #00ff41; font-size: 0.82rem; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #0d0d14;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 6px;
  padding: 28px;
  width: 400px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-sm { width: 360px; }
.modal-title { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.12em; color: #00ff41; }
.modal-warn { font-size: 0.82rem; color: rgba(0,255,65,0.7); }
.modal-warn strong { color: #ffb300; }

.field-label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.5);
}
.field-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 7px 10px;
  outline: none;
}
.field-input:focus { border-color: rgba(0,255,65,0.5); }

.modal-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.btn-cancel, .btn-confirm {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 3px;
  color: rgba(0,255,65,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 7px 16px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-cancel:hover { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm:hover { background: rgba(0,255,65,0.08); }
.btn-confirm.btn-red { border-color: rgba(255,68,68,0.4); color: #ff4444; }
.btn-confirm.btn-red:hover { background: rgba(255,68,68,0.08); }
</style>
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/playlists/+page.svelte
git commit -m "feat(admin): playlists — UI tableau + modals"
```

---

## Task 6 : Playlists detail — server (`/admin/playlists/[id]`)

**Files:**
- Create: `src/routes/(admin)/admin/playlists/[id]/+page.server.js`

- [ ] **Créer le fichier**

```js
import { error, redirect } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/config.js";
import { requireAdmin, logAdminAction } from "$lib/server/middleware/auth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id) {
  if (!UUID_RE.test(id)) throw error(400, "ID invalide");
}

export async function load({ params }) {
  const sb = getAdminClient();
  assertUuid(params.id);

  const [playlistRes, tracksRes] = await Promise.all([
    sb
      .from("custom_playlists")
      .select("id, name, emoji, owner_id, is_public, is_official, track_count, created_at, updated_at, profiles!owner_id(username)")
      .eq("id", params.id)
      .single(),
    sb
      .from("custom_playlist_tracks")
      .select("id, playlist_id, artist, title, preview_url, cover_url, source, position, created_at")
      .eq("playlist_id", params.id)
      .order("position", { ascending: true }),
  ]);

  if (playlistRes.error || !playlistRes.data)
    throw error(404, "Playlist introuvable");

  return {
    playlist: playlistRes.data,
    tracks: tracksRes.data ?? [],
  };
}

export const actions = {
  deleteTrack: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const trackId = formData.get("track_id");
    const sb = getAdminClient();
    const { data: track } = await sb
      .from("custom_playlist_tracks")
      .select("artist, title")
      .eq("id", trackId)
      .single();
    const { error: err } = await sb
      .from("custom_playlist_tracks")
      .delete()
      .eq("id", trackId);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_track", params.id, "playlist", {
      track_id: trackId,
      artist: track?.artist,
      title: track?.title,
    });
    return { success: true };
  },

  reorderTrack: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const trackId = formData.get("track_id");
    const direction = formData.get("direction"); // 'up' | 'down'
    if (!["up", "down"].includes(direction))
      throw error(400, "Direction invalide");
    const sb = getAdminClient();
    const { data: tracks } = await sb
      .from("custom_playlist_tracks")
      .select("id, position")
      .eq("playlist_id", params.id)
      .order("position", { ascending: true });

    if (!tracks) return { success: false, error: "Tracks introuvables" };

    const idx = tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return { success: false, error: "Track introuvable" };

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tracks.length) return { success: true };

    const a = tracks[idx];
    const b = tracks[swapIdx];

    await sb
      .from("custom_playlist_tracks")
      .update({ position: b.position })
      .eq("id", a.id);
    await sb
      .from("custom_playlist_tracks")
      .update({ position: a.position })
      .eq("id", b.id);

    await logAdminAction(adminUser.id, "reorder_tracks", params.id, "playlist", {
      moved_track_id: trackId,
      direction,
      old_position: a.position,
      new_position: b.position,
    });
    return { success: true };
  },

  deletePlaylist: async ({ request, params }) => {
    assertUuid(params.id);
    const { adminUser, formData } = await requireAdmin(request);
    const sb = getAdminClient();
    const { data: playlist } = await sb
      .from("custom_playlists")
      .select("name, track_count")
      .eq("id", params.id)
      .single();
    const { error: err } = await sb
      .from("custom_playlists")
      .delete()
      .eq("id", params.id);
    if (err) return { success: false, error: err.message };
    await logAdminAction(adminUser.id, "delete_playlist", params.id, "playlist", {
      name: playlist?.name,
      track_count: playlist?.track_count,
    });
    redirect(302, "/admin/playlists");
  },
};
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/playlists/\[id\]/+page.server.js
git commit -m "feat(admin): playlist detail — server load + actions"
```

---

## Task 7 : Playlists detail — UI (`/admin/playlists/[id]`)

**Files:**
- Create: `src/routes/(admin)/admin/playlists/[id]/+page.svelte`

- [ ] **Créer le fichier**

```svelte
<script>
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { getContext } from 'svelte';

  let { data, form } = $props();
  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  const playlist = $derived(data.playlist);
  const tracks   = $derived(data.tracks);

  let deletePlaylistModal = $state(false);

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }
</script>

<div class="pl-detail">
  <a href="/admin/playlists" class="back">← BACK_TO_LIST</a>

  <div class="pl-header">
    <div class="pl-title">{playlist.emoji} {playlist.name}</div>
    <div class="pl-meta">
      <span class="meta-item">OWNER: <strong>{playlist.profiles?.username ?? '—'}</strong></span>
      <span class="meta-item">TRACKS: <strong>{playlist.track_count}</strong></span>
      <span class="meta-item">CREATED: <strong>{fmt(playlist.created_at)}</strong></span>
      <span class="meta-item">UPDATED: <strong>{fmt(playlist.updated_at)}</strong></span>
      {#if playlist.is_official}<span class="badge-official">★ OFFICIAL</span>{/if}
      {#if !playlist.is_public}<span class="badge-private">🔒 PRIVATE</span>{/if}
    </div>
  </div>

  {#if form && !form.success}
    <div class="alert-err">[ERROR] {form.error ?? 'Action échouée'}</div>
  {/if}
  {#if form?.success}
    <div class="alert-ok">[OK] Action appliquée.</div>
  {/if}

  <div class="section-title">// TRACKS ({tracks.length})</div>

  {#if tracks.length === 0}
    <div class="empty">Aucune track.</div>
  {:else}
    <div class="table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th>POS</th>
            <th>ARTIST</th>
            <th>TITLE</th>
            <th>SOURCE</th>
            <th>PREVIEW</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each tracks as t, i (t.id)}
            <tr>
              <td class="td-pos">{t.position}</td>
              <td class="td-artist">{t.artist}</td>
              <td>{t.title}</td>
              <td class="td-dim">{t.source}</td>
              <td class="td-dim">
                {#if t.preview_url}
                  <a href={t.preview_url} target="_blank" rel="noreferrer" class="link-preview">▶ play</a>
                {:else}
                  —
                {/if}
              </td>
              <td class="td-actions">
                <!-- Réordonner ▲ -->
                <form method="POST" action="?/reorderTrack" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <input type="hidden" name="direction" value="up">
                  <button class="btn-order" disabled={i === 0}>▲</button>
                </form>
                <!-- Réordonner ▼ -->
                <form method="POST" action="?/reorderTrack" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <input type="hidden" name="direction" value="down">
                  <button class="btn-order" disabled={i === tracks.length - 1}>▼</button>
                </form>
                <!-- Supprimer -->
                <form method="POST" action="?/deleteTrack" use:enhance={() => ({ onResult: () => invalidateAll() })}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <button class="btn-del">✕</button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="danger-zone">
    <div class="section-title">// DANGER_ZONE</div>
    <button class="btn-delete-pl" onclick={() => deletePlaylistModal = true}>
      SUPPRIMER LA PLAYLIST
    </button>
  </div>
</div>

<!-- Modal delete playlist -->
{#if deletePlaylistModal}
  <div class="modal-overlay" onclick={() => deletePlaylistModal = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// DELETE_PLAYLIST</div>
      <p class="modal-warn">
        Supprimer définitivement <strong>{playlist.emoji} {playlist.name}</strong> et ses {playlist.track_count} tracks ?
      </p>
      <form method="POST" action="?/deletePlaylist" use:enhance>
        <input type="hidden" name="_token" value={token}>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={() => deletePlaylistModal = false}>CANCEL</button>
          <button type="submit" class="btn-confirm btn-red">SUPPRIMER</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
.pl-detail { display: flex; flex-direction: column; gap: 24px; }

.back {
  font-size: 0.72rem;
  color: rgba(0,255,65,0.4);
  letter-spacing: 0.05em;
  transition: color 0.1s;
  width: fit-content;
}
.back:hover { color: #00ff41; }

.pl-header { display: flex; flex-direction: column; gap: 10px; }
.pl-title { font-size: 1.3rem; font-weight: 700; letter-spacing: 0.05em; }
.pl-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.meta-item { font-size: 0.72rem; color: rgba(0,255,65,0.4); }
.meta-item strong { color: rgba(0,255,65,0.8); }
.badge-official {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #ffb300;
  background: rgba(255,179,0,0.1);
  border: 1px solid rgba(255,179,0,0.3);
  border-radius: 3px;
  padding: 2px 8px;
}
.badge-private {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  background: rgba(0,255,65,0.05);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  padding: 2px 8px;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(0,255,65,0.5);
}

.empty { font-size: 0.8rem; color: rgba(0,255,65,0.3); }

.table-wrap { overflow-x: auto; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.adm-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
}
.adm-table td {
  padding: 9px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
  vertical-align: middle;
}
.adm-table tr:hover td { background: rgba(0,255,65,0.03); }

.td-pos { color: rgba(0,255,65,0.35); font-size: 0.72rem; width: 48px; }
.td-artist { font-weight: 600; }
.td-dim { color: rgba(0,255,65,0.4); font-size: 0.75rem; }
.td-actions { display: flex; gap: 4px; align-items: center; }

.link-preview { color: rgba(0,255,65,0.5); font-size: 0.72rem; transition: color 0.1s; }
.link-preview:hover { color: #00ff41; }

.btn-order {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  color: rgba(0,255,65,0.4);
  font-size: 0.7rem;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}
.btn-order:hover:not(:disabled) { color: #00ff41; border-color: rgba(0,255,65,0.4); }
.btn-order:disabled { opacity: 0.15; cursor: not-allowed; }

.btn-del {
  background: transparent;
  border: 1px solid rgba(255,68,68,0.2);
  border-radius: 3px;
  color: rgba(255,68,68,0.5);
  font-size: 0.72rem;
  padding: 2px 7px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}
.btn-del:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); }

.alert-err { color: #ff4444; font-size: 0.82rem; }
.alert-ok { color: #00ff41; font-size: 0.82rem; }

.danger-zone { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,68,68,0.15); }
.btn-delete-pl {
  background: transparent;
  border: 1px solid rgba(255,68,68,0.3);
  border-radius: 4px;
  color: rgba(255,68,68,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 9px 20px;
  cursor: pointer;
  transition: all 0.15s;
  width: fit-content;
}
.btn-delete-pl:hover { background: rgba(255,68,68,0.08); color: #ff4444; border-color: rgba(255,68,68,0.6); }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #0d0d14;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 6px;
  padding: 28px;
  width: 400px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-title { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.12em; color: #00ff41; }
.modal-warn { font-size: 0.82rem; color: rgba(0,255,65,0.7); }
.modal-warn strong { color: #ffb300; }

.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.btn-cancel, .btn-confirm {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 3px;
  color: rgba(0,255,65,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 7px 16px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-cancel:hover { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm:hover { background: rgba(0,255,65,0.08); }
.btn-confirm.btn-red { border-color: rgba(255,68,68,0.4); color: #ff4444; }
.btn-confirm.btn-red:hover { background: rgba(255,68,68,0.08); }
</style>
```

- [ ] **Commit**

```bash
git add src/routes/\(admin\)/admin/playlists/\[id\]/+page.svelte
git commit -m "feat(admin): playlist detail — UI tracks + reorder + delete"
```

---

## Task 8 : Lint + commit final

- [ ] **Lancer le lint**

```bash
npm run lint
```

Si des erreurs : corriger avant de continuer.

- [ ] **Commit de clôture si nécessaire**

```bash
git add -A
git commit -m "style: auto-fix lint admin phase 2"
```
