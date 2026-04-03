<script>
  import { onMount } from 'svelte';

  let { sb } = $props();

  const STORAGE_KEY = 'zik_dismissed_announcements';

  let announcements = $state([]);
  let visible       = $state(false);

  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function dismiss() { visible = false; }

  function dismissForever() {
    const dismissed = getDismissed();
    for (const a of announcements) {
      if (!dismissed.includes(a.id)) dismissed.push(a.id);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    visible = false;
  }

  onMount(async () => {
    if (localStorage.getItem('zik_hide_announcements') === 'true') return;

    const dismissed = getDismissed();
    const { data } = await sb
      .from('site_announcements')
      .select('id, title, message, type')
      .eq('active', true)
      .order('created_at');

    if (!data?.length) return;
    announcements = data.filter(a => !dismissed.includes(a.id));
    if (announcements.length > 0) visible = true;
  });
</script>

{#if visible && announcements.length > 0}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="ann-backdrop" onclick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
    <div class="ann-modal" role="dialog" aria-modal="true" aria-label="Informations">
      <button class="ann-close" onclick={dismiss} aria-label="Fermer">×</button>

      <div class="ann-header">
        <span class="ann-icon">📢</span>
        <h2 class="ann-title">Informations</h2>
      </div>

      <div class="ann-list">
        {#each announcements as a (a.id)}
          <div class="ann-item ann-item--{a.type}">
            <div class="ann-item-title">{a.title}</div>
            <div class="ann-item-msg">{a.message}</div>
          </div>
        {/each}
      </div>

      <div class="ann-actions">
        <button class="ann-btn-close" onclick={dismiss}>Fermer</button>
        <button class="ann-btn-hide" onclick={dismissForever}>Ne plus afficher</button>
      </div>
    </div>
  </div>
{/if}

<style>
.ann-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.ann-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 28px 24px;
  max-width: 480px;
  width: 100%;
  position: relative;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
}
.ann-close {
  position: absolute;
  top: 14px;
  right: 16px;
  background: none;
  border: none;
  color: var(--dim);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
.ann-close:hover { color: var(--text); background: var(--surface2); }
.ann-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.ann-icon { font-size: 1.4rem; }
.ann-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
}
.ann-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
}
.ann-item {
  border-radius: 10px;
  padding: 12px 14px;
  border-left: 3px solid transparent;
}
.ann-item--warning {
  background: rgba(251, 191, 36, 0.08);
  border-left-color: #fbbf24;
}
.ann-item--info {
  background: rgba(99, 179, 237, 0.08);
  border-left-color: #63b3ed;
}
.ann-item--success {
  background: rgba(52, 211, 153, 0.08);
  border-left-color: #34d399;
}
.ann-item-title {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.ann-item-msg {
  font-size: 0.82rem;
  color: var(--mid);
  line-height: 1.5;
}
.ann-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ann-btn-close {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 20px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.ann-btn-close:hover { opacity: 0.85; }
.ann-btn-hide {
  background: none;
  border: none;
  color: var(--dim);
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
  text-decoration: underline;
  padding: 0;
  transition: color 0.15s;
}
.ann-btn-hide:hover { color: var(--text); }
</style>
