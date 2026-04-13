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
      {#each [['track_count','TRACKS'],['created_at','DATE'],['name','NAME']] as [key, label] (key)}
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
