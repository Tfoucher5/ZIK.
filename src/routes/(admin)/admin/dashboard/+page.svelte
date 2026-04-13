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
    { label: 'TOTAL_USERS',     value: () => stats.totalUsers,     color: '#00ff41' },
    { label: 'ACTIVE_7D',       value: () => stats.activeUsers7d,  color: '#00ff41' },
    { label: 'GAMES_TODAY',     value: () => stats.gamesToday,     color: '#ffb300' },
    { label: 'PUBLIC_ROOMS',    value: () => stats.publicRooms,    color: '#ffb300' },
    { label: 'REPORTS_PENDING', value: () => stats.pendingReports, color: stats.pendingReports > 0 ? '#ff4444' : '#00ff41' },
    { label: 'SERVER_UPTIME',   value: () => stats.uptime,         color: '#00bfff' },
  ];
</script>

<div class="dash">
  <div class="dash-header">
    <span class="dash-title">// CONTROL_CENTER</span>
    <span class="dash-sub">ZIK ADMIN — {new Date().toLocaleDateString('fr-FR')}</span>
  </div>

  <!-- Stats grid -->
  <div class="stats-grid">
    {#each STAT_CARDS as card (card.label)}
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
  display: flex; align-items: center; gap: 12px;
  font-size: 0.75rem; padding: 5px 0;
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
