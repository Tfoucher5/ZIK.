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
      {#each [['last_active_at','ACTIVE'],['created_at','DATE'],['name','NAME']] as [key, label] (key)}
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
