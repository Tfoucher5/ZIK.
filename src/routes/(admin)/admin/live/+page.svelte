<script>
  import { getContext, onDestroy } from 'svelte';

  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  let rooms = $state([]);
  let selected = $state(null); // roomId sélectionnée
  let sseStatus = $state('connecting'); // 'connecting' | 'ok' | 'error'
  let es = null;
  let actionMsg = $state(null);
  let actionMsgTimer = null;
  let announceText = $state('');

  const selectedRoom = $derived(rooms.find(r => r.roomId === selected) ?? null);

  function connectSSE(tok) {
    if (es) { es.close(); es = null; }
    if (!tok) return;
    sseStatus = 'connecting';
    es = new EventSource(`/api/admin/rooms/live?token=${encodeURIComponent(tok)}`);
    es.onopen = () => { sseStatus = 'ok'; };
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      rooms = d.rooms ?? [];
      sseStatus = 'ok';
    };
    es.onerror = () => {
      sseStatus = 'error';
    };
  }

  $effect(() => {
    if (token) connectSSE(token);
  });

  onDestroy(() => { if (es) es.close(); });

  function showMsg(msg, ok = true) {
    clearTimeout(actionMsgTimer);
    actionMsg = { text: msg, ok };
    actionMsgTimer = setTimeout(() => { actionMsg = null; }, 3000);
  }

  async function doAction(roomId, action, username = null, message = null) {
    const body = { _token: token, action };
    if (username) body.username = username;
    if (message) body.message = message;
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(roomId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) showMsg(`[OK] ${action} → ${roomId}`);
      else showMsg(`[FAIL] ${action} non applicable`, false);
    } catch {
      showMsg('[ERROR] Requête échouée', false);
    }
  }

  function timerPct(room) {
    if (!room.roundDuration || room.roundDuration === 0) return 0;
    return Math.max(0, Math.min(100, (room.timer / room.roundDuration) * 100));
  }
</script>

<div class="live-page">
  <div class="page-header">
    <span class="page-title">// LIVE_CONTROL</span>
    <span class="sse-dot" class:ok={sseStatus === 'ok'} class:err={sseStatus === 'error'}></span>
    <span class="sse-label">{sseStatus === 'ok' ? 'CONNECTED' : sseStatus === 'error' ? 'ERROR' : 'CONNECTING...'}</span>
    <span class="page-sub">{rooms.length} room(s) active(s)</span>
  </div>

  {#if actionMsg}
    <div class="action-msg" class:ok={actionMsg.ok} class:err={!actionMsg.ok}>{actionMsg.text}</div>
  {/if}

  <div class="layout">
    <!-- Liste rooms -->
    <div class="room-list">
      <div class="list-title">// ROOMS</div>
      {#if rooms.length === 0}
        <div class="empty">Aucune room active.</div>
      {:else}
        {#each rooms as r (r.roomId)}
          <button
            class="room-item"
            class:selected={selected === r.roomId}
            onclick={() => selected = r.roomId}
          >
            <span class="ri-id">{r.roomId}</span>
            <span class="ri-meta">
              {r.playerCount}p · {r.isActive ? `R${r.currentRound}/${r.maxRounds}` : 'LOBBY'}
              {#if r.isPaused}<span class="badge-paused">⏸</span>{/if}
              {#if r.adminBlocked}<span class="badge-blocked">🔒</span>{/if}
            </span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Détail room sélectionnée -->
    <div class="room-detail">
      {#if !selectedRoom}
        <div class="no-select">← Sélectionner une room</div>
      {:else}
        <div class="detail-header">
          <span class="detail-id">// {selectedRoom.roomId}</span>
          <div class="detail-actions">
            {#if selectedRoom.isActive && !selectedRoom.isPaused}
              <button class="act-btn act-pause" onclick={() => doAction(selectedRoom.roomId, 'pause')}>⏸ PAUSE</button>
            {/if}
            {#if selectedRoom.isPaused}
              <button class="act-btn act-resume" onclick={() => doAction(selectedRoom.roomId, 'resume')}>▶ RESUME</button>
            {/if}
            {#if selectedRoom.isActive}
              <button class="act-btn act-skip" onclick={() => doAction(selectedRoom.roomId, 'skip_round')}>⏭ SKIP ROUND</button>
            {/if}
            <button class="act-btn act-end" onclick={() => doAction(selectedRoom.roomId, 'end_game')}>■ END GAME</button>
            {#if !selectedRoom.adminBlocked}
              <button class="act-btn act-block" onclick={() => doAction(selectedRoom.roomId, 'block')}>🔒 LOCK</button>
            {:else}
              <button class="act-btn act-unblock" onclick={() => doAction(selectedRoom.roomId, 'unblock')}>🔓 UNLOCK</button>
            {/if}
          </div>
        </div>

        <!-- État du round -->
        <div class="round-state">
          {#if selectedRoom.isActive}
            <div class="rs-row">
              <span class="rs-label">ROUND</span>
              <span class="rs-val">{selectedRoom.currentRound} / {selectedRoom.maxRounds}</span>
            </div>
            {#if selectedRoom.isPaused}
              <div class="rs-row"><span class="rs-label badge-paused-lg">⏸ PAUSED</span></div>
            {:else if selectedRoom.isSyncWaiting}
              <div class="rs-row">
                <span class="rs-label">SYNC</span>
                <span class="rs-val">En attente ({selectedRoom.readyCount} prêts)</span>
              </div>
            {:else}
              <div class="rs-row">
                <span class="rs-label">TIMER</span>
                <span class="rs-val">{selectedRoom.timer}s</span>
              </div>
              <div class="timer-bar">
                <div class="timer-fill" style="width: {timerPct(selectedRoom)}%"></div>
              </div>
            {/if}
            {#if selectedRoom.currentTrack}
              <div class="rs-row rs-track">
                <span class="rs-label">TRACK</span>
                <span class="rs-track-val">{selectedRoom.currentTrack.artist} — {selectedRoom.currentTrack.title}</span>
              </div>
            {/if}
          {:else}
            <div class="rs-row"><span class="rs-label">ÉTAT</span><span class="rs-val rs-lobby">LOBBY</span></div>
          {/if}
        </div>

        <!-- Tableau joueurs -->
        <!-- Annonce -->
        <div class="announce-zone">
          <div class="section-title">// ANNOUNCE</div>
          <div class="announce-row">
            <input
              class="announce-input"
              type="text"
              maxlength="200"
              placeholder="> Message affiché sur les écrans..."
              bind:value={announceText}
              onkeydown={(e) => { if (e.key === 'Enter' && announceText.trim()) { doAction(selectedRoom.roomId, 'announce', null, announceText); announceText = ''; } }}
            />
            <button
              class="act-btn act-announce"
              disabled={!announceText.trim()}
              onclick={() => { doAction(selectedRoom.roomId, 'announce', null, announceText); announceText = ''; }}
            >SEND</button>
          </div>
        </div>

        <div class="section-title">// PLAYERS ({selectedRoom.playerCount})</div>
        {#if selectedRoom.players.length === 0}
          <div class="empty">Aucun joueur.</div>
        {:else}
          <table class="adm-table">
            <thead>
              <tr>
                <th>USERNAME</th>
                <th>SCORE</th>
                <th>ARTIST</th>
                <th>TITLE</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each selectedRoom.players as p (p.name)}
                <tr>
                  <td class="td-name">{p.name}</td>
                  <td class="td-score">{p.score}</td>
                  <td class="td-found">{p.foundArtist ? '✓' : '✗'}</td>
                  <td class="td-found">{p.foundTitle ? '✓' : '✗'}</td>
                  <td>
                    <button
                      class="btn-kick"
                      onclick={() => doAction(selectedRoom.roomId, 'kick', p.name)}
                    >KICK</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
.live-page { display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; }
.page-sub { font-size: 0.72rem; color: rgba(0,255,65,0.4); margin-left: 4px; }

.sse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(0,255,65,0.2);
  flex-shrink: 0;
}
.sse-dot.ok { background: #00ff41; box-shadow: 0 0 6px #00ff41; animation: pulse 2s infinite; }
.sse-dot.err { background: #ff4444; box-shadow: 0 0 6px #ff4444; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.sse-label { font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(0,255,65,0.4); }

.action-msg {
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 3px;
  border: 1px solid rgba(0,255,65,0.2);
  color: rgba(0,255,65,0.7);
  background: rgba(0,255,65,0.04);
}
.action-msg.ok { color: #00ff41; border-color: rgba(0,255,65,0.4); }
.action-msg.err { color: #ff4444; border-color: rgba(255,68,68,0.4); background: rgba(255,68,68,0.04); }

.layout { display: grid; grid-template-columns: 220px 1fr; gap: 16px; min-height: 400px; }

/* Liste */
.room-list {
  border: 1px solid rgba(0,255,65,0.12);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.list-title { font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(0,255,65,0.4); margin-bottom: 8px; }
.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: 1px solid rgba(0,255,65,0.08);
  border-radius: 3px;
  color: rgba(0,255,65,0.6);
  font-family: inherit;
  font-size: 0.75rem;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s;
  width: 100%;
}
.room-item:hover { border-color: rgba(0,255,65,0.3); color: #00ff41; background: rgba(0,255,65,0.04); }
.room-item.selected { border-color: rgba(0,255,65,0.5); color: #00ff41; background: rgba(0,255,65,0.06); }
.ri-id { font-weight: 700; letter-spacing: 0.05em; }
.ri-meta { font-size: 0.65rem; color: rgba(0,255,65,0.4); }
.room-item.selected .ri-meta { color: rgba(0,255,65,0.6); }
.badge-paused { color: #ffb300; font-size: 0.7rem; }
.badge-blocked { font-size: 0.7rem; }
.empty { font-size: 0.78rem; color: rgba(0,255,65,0.3); padding: 8px 0; }

/* Détail */
.room-detail {
  border: 1px solid rgba(0,255,65,0.12);
  border-radius: 4px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.no-select { font-size: 0.8rem; color: rgba(0,255,65,0.25); margin: auto; }

.detail-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.detail-id { font-size: 1rem; font-weight: 700; letter-spacing: 0.12em; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.act-btn {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.25);
  border-radius: 3px;
  color: rgba(0,255,65,0.5);
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.1s;
}
.act-btn:hover { color: #00ff41; border-color: rgba(0,255,65,0.5); background: rgba(0,255,65,0.06); }
.act-pause:hover { color: #ffb300; border-color: rgba(255,179,0,0.5); background: rgba(255,179,0,0.06); }
.act-resume { border-color: rgba(0,255,65,0.4); color: #00ff41; }
.act-end { border-color: rgba(255,68,68,0.25); color: rgba(255,68,68,0.5); }
.act-end:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); background: rgba(255,68,68,0.06); }
.act-block { border-color: rgba(255,179,0,0.25); color: rgba(255,179,0,0.5); }
.act-block:hover { color: #ffb300; border-color: rgba(255,179,0,0.5); background: rgba(255,179,0,0.06); }
.act-unblock { border-color: rgba(0,255,65,0.4); color: #00ff41; }
.act-announce { border-color: rgba(255,179,0,0.4); color: #ffb300; flex-shrink: 0; }
.act-announce:hover { background: rgba(255,179,0,0.08); }
.act-announce:disabled { opacity: 0.25; cursor: not-allowed; }

.announce-zone { display: flex; flex-direction: column; gap: 8px; }
.announce-row { display: flex; gap: 8px; }
.announce-input {
  flex: 1;
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.8rem;
  padding: 7px 12px;
  outline: none;
}
.announce-input::placeholder { color: rgba(0,255,65,0.2); }
.announce-input:focus { border-color: rgba(0,255,65,0.4); }

.round-state { display: flex; flex-direction: column; gap: 8px; }
.rs-row { display: flex; align-items: center; gap: 12px; font-size: 0.8rem; }
.rs-label { font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(0,255,65,0.4); width: 60px; }
.rs-val { color: rgba(0,255,65,0.8); font-variant-numeric: tabular-nums; }
.rs-lobby { color: rgba(0,255,65,0.4); }
.rs-track { align-items: flex-start; }
.rs-track-val { color: rgba(255,179,0,0.8); font-size: 0.78rem; }
.badge-paused-lg { color: #ffb300; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; width: auto; }

.timer-bar {
  height: 3px;
  background: rgba(0,255,65,0.1);
  border-radius: 2px;
  overflow: hidden;
  width: 100%;
  max-width: 300px;
}
.timer-fill {
  height: 100%;
  background: #00ff41;
  border-radius: 2px;
  transition: width 0.9s linear;
}

.section-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; color: rgba(0,255,65,0.4); }

.adm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.adm-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 6px 10px;
  border-bottom: 1px solid rgba(0,255,65,0.12);
}
.adm-table td {
  padding: 9px 10px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
  vertical-align: middle;
}
.adm-table tr:hover td { background: rgba(0,255,65,0.03); }

.td-name { font-weight: 600; }
.td-score { font-variant-numeric: tabular-nums; color: #ffb300; }
.td-found { font-size: 1rem; }
.adm-table td.td-found { color: rgba(0,255,65,0.3); }
.adm-table tr:has(.td-found:first-of-type) td.td-found:first-of-type { color: #00ff41; }

.btn-kick {
  background: transparent;
  border: 1px solid rgba(255,68,68,0.2);
  border-radius: 3px;
  color: rgba(255,68,68,0.5);
  font-family: inherit;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-kick:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); background: rgba(255,68,68,0.06); }
</style>
