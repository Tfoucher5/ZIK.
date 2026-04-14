<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  let { data } = $props();

  let expandedId = $state(null);
  let noteValues = $state({});
  let replyValues = $state({});
  let sentIds = $state({});

  const TYPE_LABELS  = { bug: 'BUG', user: 'USER', contact: 'CONTACT' };
  const STATUS_COLORS = { pending: '#ffb300', resolved: '#00ff41', dismissed: 'rgba(0,255,65,0.25)' };

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function setFilter(key, value) {
    const p = new SvelteURLSearchParams(page.url.searchParams);
    if (value) p.set(key, value); else p.delete(key);
    goto(`?${p.toString()}`);
  }
</script>

<div class="rp-page">
  <div class="page-header">
    <span class="page-title">// REPORTS [{data.reports.length}]</span>
    <div class="rp-filters">
      <select onchange={e => setFilter('status', e.target.value)} value={data.filters.status} class="adm-select">
        <option value="pending">PENDING</option>
        <option value="resolved">RESOLVED</option>
        <option value="dismissed">DISMISSED</option>
        <option value="">ALL</option>
      </select>
      <select onchange={e => setFilter('type', e.target.value)} value={data.filters.type} class="adm-select">
        <option value="">ALL_TYPES</option>
        <option value="bug">BUG</option>
        <option value="user">USER</option>
        <option value="contact">CONTACT</option>
      </select>
    </div>
  </div>

  {#if data.error}
    <div class="alert-err">[ERROR] {data.error}</div>
  {:else if data.reports.length === 0}
    <div class="empty">-- NO REPORTS --</div>
  {:else}
    <div class="rp-list">
      {#each data.reports as r (r.id)}
        <div class="rp-card" class:expanded={expandedId === r.id} data-status={r.status}>
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="rp-head" onclick={() => expandedId = expandedId === r.id ? null : r.id}>
            <span class="rp-dot" style="background:{STATUS_COLORS[r.status]}"></span>
            <span class="rp-type">[{TYPE_LABELS[r.type] || r.type}]</span>
            <span class="rp-from">
              {r.resolved_username || r.reporter_email || 'ANON'}
            </span>
            {#if r.reported_username}
              <span class="rp-target">→ {r.reported_username}</span>
            {/if}
            {#if r.resolved_room}
              <span class="rp-room">#{r.resolved_room.emoji}{r.resolved_room.name}</span>
            {:else if r.room_id}
              <span class="rp-room">#{r.room_id}</span>
            {/if}
            <span class="rp-date">{fmt(r.created_at)}</span>
            <span class="rp-chevron">{expandedId === r.id ? '▲' : '▼'}</span>
          </div>

          {#if expandedId === r.id}
            <div class="rp-body">
              {#if r.subject}
                <div class="rp-field"><span class="fl">SUBJECT:</span> <span class="fv">{r.subject}</span></div>
              {/if}
              <div class="rp-message">{r.message}</div>

              {#if r.metadata && Object.keys(r.metadata).length}
                <pre class="rp-meta">{JSON.stringify(r.metadata, null, 2)}</pre>
              {/if}

              <form method="POST" action="?/updateStatus" use:enhance={({ formElement }) => {
                const isReply = formElement.getAttribute('data-reply') === 'true';
                return async ({ result, update }) => {
                  if (isReply && result.type === 'success') sentIds = { ...sentIds, [r.id]: true };
                  setTimeout(() => { sentIds = { ...sentIds, [r.id]: false }; }, 3000);
                  await update({ reset: false });
                };
              }} class="rp-actions">
                <input type="hidden" name="id" value={r.id}>

                <div class="rp-row">
                  <span class="fl">ADMIN_NOTE:</span>
                  <textarea
                    name="admin_note"
                    class="rp-textarea"
                    placeholder="Note interne…"
                    rows="2"
                    bind:value={noteValues[r.id]}
                  >{r.admin_note || ''}</textarea>
                </div>

                {#if r.reporter_email || r.resolved_username}
                  <div class="rp-row">
                    <span class="fl">
                      REPLY{r.reporter_email ? ` → ${r.reporter_email}` : ' (no email — stocké seulement)'}:
                    </span>
                    <textarea
                      name="admin_reply"
                      class="rp-textarea"
                      placeholder="Réponse…"
                      rows="3"
                      bind:value={replyValues[r.id]}
                    >{r.admin_reply || ''}</textarea>
                    {#if r.reporter_email}
                      <button
                        type="submit"
                        formaction="?/sendReply"
                        data-reply="true"
                        class="btn-action btn-amber"
                        disabled={!replyValues[r.id]?.trim()}
                      >{sentIds[r.id] ? '[OK] SENT' : '📨 SEND_REPLY'}</button>
                    {/if}
                  </div>
                {/if}

                {#if r.admin_reply}
                  <div class="rp-saved">// SAVED_REPLY: {r.admin_reply}</div>
                {/if}

                <div class="rp-btns">
                  <button name="status" value="resolved" class="btn-action btn-green">✓ RESOLVE</button>
                  <button name="status" value="dismissed" class="btn-action btn-ghost">✕ DISMISS</button>
                  {#if r.status !== 'pending'}
                    <button name="status" value="pending" class="btn-action btn-amber">↩ REOPEN</button>
                  {/if}
                </div>
              </form>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
.rp-page { display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; }

.rp-filters { display: flex; gap: 8px; }
.adm-select {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  padding: 6px 10px;
  outline: none;
  cursor: pointer;
}
.adm-select option { background: #0a0a0f; }
.adm-select:focus { border-color: rgba(0,255,65,0.5); }

.alert-err { color: #ff4444; font-size: 0.82rem; background: rgba(255,68,68,0.06); border: 1px solid rgba(255,68,68,0.2); padding: 8px 12px; border-radius: 3px; }
.empty { font-size: 0.8rem; color: rgba(0,255,65,0.25); padding: 24px 0; }

.rp-list { display: flex; flex-direction: column; gap: 4px; }

.rp-card {
  border: 1px solid rgba(0,255,65,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.rp-card[data-status="pending"]  { border-left: 3px solid #ffb300; }
.rp-card[data-status="resolved"] { border-left: 3px solid rgba(0,255,65,0.5); }
.rp-card[data-status="dismissed"]{ border-left: 3px solid rgba(0,255,65,0.15); }

.rp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  font-size: 0.78rem;
  flex-wrap: wrap;
}
.rp-head:hover { background: rgba(0,255,65,0.03); }

.rp-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.rp-type { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; color: rgba(0,255,65,0.5); min-width: 70px; }
.rp-from { color: rgba(0,255,65,0.8); font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-target { font-size: 0.72rem; color: #ff4444; white-space: nowrap; }
.rp-room { font-size: 0.68rem; color: rgba(0,255,65,0.3); white-space: nowrap; }
.rp-date { font-size: 0.68rem; color: rgba(0,255,65,0.25); white-space: nowrap; margin-left: auto; }
.rp-chevron { font-size: 0.6rem; color: rgba(0,255,65,0.3); }

.rp-body {
  padding: 12px 14px 16px;
  border-top: 1px solid rgba(0,255,65,0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rp-field { font-size: 0.75rem; }
.fl { font-size: 0.65rem; letter-spacing: 0.08em; color: rgba(0,255,65,0.4); }
.fv { color: rgba(0,255,65,0.8); }

.rp-message {
  background: rgba(0,255,65,0.02);
  border: 1px solid rgba(0,255,65,0.08);
  border-radius: 3px;
  padding: 10px 12px;
  font-size: 0.8rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(0,255,65,0.75);
}

.rp-meta {
  background: rgba(0,0,0,0.3);
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 0.7rem;
  color: rgba(0,255,65,0.3);
  overflow-x: auto;
}

.rp-actions { display: flex; flex-direction: column; gap: 8px; }

.rp-row { display: flex; flex-direction: column; gap: 5px; }

.rp-textarea {
  background: rgba(0,255,65,0.03);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.78rem;
  padding: 8px 10px;
  resize: vertical;
  outline: none;
  width: 100%;
}
.rp-textarea:focus { border-color: rgba(0,255,65,0.4); }
.rp-textarea::placeholder { color: rgba(0,255,65,0.2); }

.rp-saved { font-size: 0.7rem; color: rgba(0,255,65,0.4); border-left: 2px solid rgba(0,255,65,0.2); padding-left: 8px; }

.rp-btns { display: flex; gap: 6px; flex-wrap: wrap; }

.btn-action {
  border: none;
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 6px 14px;
  cursor: pointer;
  transition: opacity 0.1s;
}
.btn-action:disabled { opacity: 0.25; cursor: not-allowed; }
.btn-action:hover:not(:disabled) { opacity: 0.8; }
.btn-green { background: rgba(0,255,65,0.1); color: #00ff41; border: 1px solid rgba(0,255,65,0.3); }
.btn-amber { background: rgba(255,179,0,0.1); color: #ffb300; border: 1px solid rgba(255,179,0,0.3); }
.btn-ghost { background: transparent; color: rgba(0,255,65,0.4); border: 1px solid rgba(0,255,65,0.15); }
</style>
