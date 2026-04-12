<script>
  /** icon: string (emoji), title: string, description: string, href: string|null */
  let { icon = null, title, description, href = null } = $props();
  const tag = href ? 'a' : 'div';
</script>

<svelte:element this={tag} class="glass-card" {href}>
  {#if icon}<div class="gc-icon">{icon}</div>{/if}
  <div class="gc-title">{title}</div>
  <div class="gc-desc">{description}</div>
</svelte:element>

<style>
  .glass-card {
    background: rgb(var(--c-glass) / 0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px;
    position: relative;
    overflow: hidden;
    transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    display: block;
    color: var(--text);
  }
  .glass-card::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.1), transparent);
    pointer-events: none;
  }
  .glass-card:hover {
    background: rgb(var(--c-glass) / 0.065);
    border-color: var(--border2);
    transform: translateY(-3px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }
  .gc-icon { font-size: 1.5rem; margin-bottom: 12px; }
  .gc-title { font-size: 0.92rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
  .gc-desc { font-size: 0.78rem; color: var(--mid); line-height: 1.55; }
</style>
