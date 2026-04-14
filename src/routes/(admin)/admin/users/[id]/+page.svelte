<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';

  let { data, form } = $props();

  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  const profile  = $derived(data.profile);
  const games    = $derived(data.games);
  const reports  = $derived(data.reports);
  const isBanned = $derived(data.isBanned);

  let confirmUsername = $state('');
  let showDeleteModal = $state(false);
  let showResetModal = $state(false);
  let banDuration = $state('87600h');

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  $effect(() => {
    if (form?.deleted) goto('/admin/users');
  });
</script>

<div class="user-page">
  <a href="/admin/users" class="back">← BACK_TO_LIST</a>

  <div class="user-header">
    <img src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${profile.username}`} alt="" class="user-avatar">
    <div class="user-info">
      <div class="user-name">
        {profile.username}
        <a href="/user/{profile.username}" target="_blank" rel="noreferrer" class="profile-link">↗ PROFIL</a>
      </div>
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

    <div class="action-card">
      <div class="action-title">// BAN_CONTROL</div>
      {#if isBanned}
        <form method="POST" action="?/unban" use:enhance>
          <input type="hidden" name="_token" value={token}>
          <button class="btn-action btn-green">UNBAN USER</button>
        </form>
      {:else}
        <form method="POST" action="?/ban" use:enhance class="form-inline">
          <input type="hidden" name="_token" value={token}>
          <label>Durée
            <select name="duration" bind:value={banDuration} class="adm-select">
              <option value="24h">24 heures</option>
              <option value="168h">7 jours</option>
              <option value="720h">30 jours</option>
              <option value="8760h">1 an</option>
              <option value="87600h">10 ans</option>
            </select>
          </label>
          <button class="btn-action btn-red">BAN USER</button>
        </form>
      {/if}
    </div>

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

    <div class="action-card">
      <div class="action-title">// EDIT_USERNAME</div>
      <form method="POST" action="?/editUsername" use:enhance class="form-inline">
        <input type="hidden" name="_token" value={token}>
        <label>New username<input type="text" name="username" value={profile.username} minlength="3" maxlength="20"></label>
        <button class="btn-action btn-amber">RENAME</button>
      </form>
    </div>

    <div class="action-card">
      <div class="action-title">// RESET_STATS</div>
      <p class="action-desc">Remet XP=0, ELO=1000, LVL=1, games=0, score=0</p>
      {#if showResetModal}
        <form method="POST" action="?/resetStats" use:enhance onsubmit={() => showResetModal = false}>
          <input type="hidden" name="_token" value={token}>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-action btn-red">CONFIRM RESET</button>
            <button type="button" class="btn-action btn-ghost" onclick={() => showResetModal = false}>CANCEL</button>
          </div>
        </form>
      {:else}
        <button class="btn-action btn-red" onclick={() => showResetModal = true}>RESET ALL STATS</button>
      {/if}
    </div>

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

    <div class="action-card action-card--danger">
      <div class="action-title">// TERMINATE_ACCOUNT</div>
      <p class="action-desc">Suppression définitive et irréversible.</p>
      <button class="btn-action btn-red" onclick={() => showDeleteModal = true}>DELETE ACCOUNT</button>
    </div>

  </div>

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
.user-name { font-size: 1.3rem; font-weight: 700; color: #00ff41; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.profile-link { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; color: rgba(0,255,65,0.4); border: 1px solid rgba(0,255,65,0.2); border-radius: 3px; padding: 2px 8px; transition: all 0.1s; }
.profile-link:hover { color: #00ff41; border-color: rgba(0,255,65,0.5); }
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
.empty { font-size: 0.75rem; color: rgba(0,255,65,0.25); padding: 12px 0; }
</style>
