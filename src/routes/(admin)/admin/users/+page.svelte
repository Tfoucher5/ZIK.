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
