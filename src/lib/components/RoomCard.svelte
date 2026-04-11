<script>
  /**
   * room: { emoji, name, description, playerCount, maxPlayers, isOfficial, isPublic, code }
   * accentColor: string CSS (défaut var(--accent))
   * onclick: function
   */
  let { room, accentColor = 'var(--accent)', onclick = null } = $props();
</script>

<div
  class="room-card"
  style="--rc:{accentColor}"
  role="button"
  tabindex="0"
  onclick={onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
  <div class="rc-stripe"></div>
  <div class="rc-emoji">{room.emoji || '🎵'}</div>
  <div class="rc-info">
    <div class="rc-name">{room.name}</div>
    {#if room.description}
      <div class="rc-desc">{room.description}</div>
    {:else}
      <div class="rc-desc">{room.isOfficial ? 'Room officielle' : 'Room publique'}</div>
    {/if}
  </div>
  <div class="rc-count">{room.playerCount ?? 0}</div>
</div>

<style>
  .room-card {
    background: rgb(var(--c-glass) / 0.035);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s, border-color 0.2s;
    position: relative;
    overflow: hidden;
  }
  .room-card:hover {
    background: rgb(var(--c-glass) / 0.06);
    border-color: var(--border2);
    transform: translateX(3px);
  }
  .rc-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--rc, var(--accent));
    box-shadow: 0 0 10px var(--rc, var(--accent));
    border-radius: 0 2px 2px 0;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  .room-card:hover .rc-stripe { opacity: 1; }
  .rc-emoji { font-size: 1.4rem; flex-shrink: 0; }
  .rc-info { flex: 1; min-width: 0; }
  .rc-name {
    font-size: 0.88rem; font-weight: 700; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rc-desc { font-size: 0.72rem; color: var(--mid); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rc-count {
    display: flex; align-items: center;
    font-size: 0.72rem; font-weight: 700; color: var(--accent);
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.15);
    padding: 3px 10px; border-radius: 20px; flex-shrink: 0;
    min-width: 32px; justify-content: center;
  }
</style>
