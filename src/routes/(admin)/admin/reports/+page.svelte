<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  let { data } = $props();

  let expandedId = $state(null);
  let noteValues = $state({});

  const TYPE_LABELS  = { bug: '🐛 Bug', user: '🚨 Joueur', contact: '✉️ Contact' };
  const STATUS_COLORS = { pending: '#f59e0b', resolved: '#4ade80', dismissed: '#6b7280' };

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function setFilter(key, value) {
    const p = new URLSearchParams(page.url.searchParams);
    if (value) p.set(key, value); else p.delete(key);
    goto(`?${p.toString()}`);
  }
</script>

<div class="rp-header">
  <h1 class="rp-title">📋 Reports</h1>
  <div class="rp-filters">
    <select onchange={e => setFilter('status', e.target.value)} value={data.filters.status}>
      <option value="pending">En attente</option>
      <option value="resolved">Résolus</option>
      <option value="dismissed">Ignorés</option>
      <option value="">Tous</option>
    </select>
    <select onchange={e => setFilter('type', e.target.value)} value={data.filters.type}>
      <option value="">Tous types</option>
      <option value="bug">🐛 Bug</option>
      <option value="user">🚨 Joueur</option>
      <option value="contact">✉️ Contact</option>
    </select>
  </div>
</div>

{#if data.error}
  <div class="rp-error">Erreur : {data.error}</div>
{:else if data.reports.length === 0}
  <div class="rp-empty">Aucun report pour ces filtres.</div>
{:else}
  <div class="rp-list">
    {#each data.reports as r (r.id)}
      <div class="rp-card {r.status}" class:expanded={expandedId === r.id}>

        <!-- En-tête de la carte -->
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="rp-card-head" onclick={() => expandedId = expandedId === r.id ? null : r.id}>
          <span class="rp-type">{TYPE_LABELS[r.type] || r.type}</span>
          <span class="rp-dot" style="background:{STATUS_COLORS[r.status]}"></span>
          <span class="rp-from">
            {#if r.reporter_name || r.reporter_email}
              {r.reporter_name || ''}{r.reporter_name && r.reporter_email ? ' — ' : ''}{r.reporter_email || ''}
            {:else}
              Anonyme
            {/if}
          </span>
          {#if r.reported_username}
            <span class="rp-target">→ {r.reported_username}</span>
          {/if}
          {#if r.room_id}
            <span class="rp-room">room: {r.room_id}</span>
          {/if}
          <span class="rp-date">{fmt(r.created_at)}</span>
          <span class="rp-chevron">{expandedId === r.id ? '▲' : '▼'}</span>
        </div>

        <!-- Détail (dépliable) -->
        {#if expandedId === r.id}
          <div class="rp-card-body">
            {#if r.subject}
              <p class="rp-subject"><strong>Objet :</strong> {r.subject}</p>
            {/if}
            <div class="rp-message">{r.message}</div>

            {#if r.metadata && Object.keys(r.metadata).length}
              <pre class="rp-meta">{JSON.stringify(r.metadata, null, 2)}</pre>
            {/if}

            <form method="POST" action="?/updateStatus" use:enhance class="rp-actions">
              <input type="hidden" name="id" value={r.id}>
              <textarea
                name="admin_note"
                class="rp-note"
                placeholder="Note interne (optionnel)…"
                rows="2"
                bind:value={noteValues[r.id]}
              >{r.admin_note || ''}</textarea>
              <div class="rp-btns">
                <button name="status" value="resolved" class="rp-btn rp-btn-resolve">✓ Résolu</button>
                <button name="status" value="dismissed" class="rp-btn rp-btn-dismiss">✕ Ignorer</button>
                {#if r.status !== 'pending'}
                  <button name="status" value="pending" class="rp-btn rp-btn-reopen">↩ Rouvrir</button>
                {/if}
              </div>
            </form>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
.rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}
.rp-title {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
}
.rp-filters { display: flex; gap: 10px; }
.rp-filters select {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #e2e8f0;
  padding: 7px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
}
.rp-filters select:focus { border-color: #6366f1; }

.rp-error { color: #f87171; background: rgba(248,113,113,0.1); padding: 12px 16px; border-radius: 10px; }
.rp-empty { color: #64748b; text-align: center; padding: 60px 0; font-size: 0.9rem; }

.rp-list { display: flex; flex-direction: column; gap: 8px; }

.rp-card {
  background: #111827;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.rp-card.pending  { border-left: 3px solid #f59e0b; }
.rp-card.resolved { border-left: 3px solid #4ade80; }
.rp-card.dismissed{ border-left: 3px solid #374151; }
.rp-card:hover    { border-color: rgba(255,255,255,0.14); }

.rp-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}
.rp-type {
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255,255,255,0.06);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.rp-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.rp-from { font-size: 0.82rem; color: #94a3b8; flex: 1; min-width: 0; }
.rp-target { font-size: 0.8rem; color: #f87171; white-space: nowrap; }
.rp-room { font-size: 0.75rem; color: #64748b; font-family: monospace; }
.rp-date { font-size: 0.75rem; color: #475569; white-space: nowrap; margin-left: auto; }
.rp-chevron { font-size: 0.65rem; color: #475569; }

.rp-card-body {
  padding: 0 16px 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.rp-subject { font-size: 0.82rem; color: #94a3b8; margin: 12px 0 6px; }
.rp-message {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 12px;
  font-size: 0.85rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.rp-meta {
  margin-top: 8px;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 10px;
  font-size: 0.72rem;
  color: #64748b;
  overflow-x: auto;
}
.rp-actions { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.rp-note {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 9px 12px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.83rem;
  resize: vertical;
  outline: none;
}
.rp-note:focus { border-color: #6366f1; }
.rp-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.rp-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.rp-btn:hover { opacity: 0.85; }
.rp-btn-resolve  { background: rgba(74,222,128,0.15); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
.rp-btn-dismiss  { background: rgba(107,114,128,0.15); color: #9ca3af; border: 1px solid rgba(107,114,128,0.3); }
.rp-btn-reopen   { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
</style>
