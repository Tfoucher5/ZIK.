<script>
  /**
   * HeroSection — Section hero Aurora Glass réutilisable
   * Props :
   *   badge      : string|null — texte du badge live (ex: "47 joueurs en ligne")
   *   title      : string      — première partie du titre (texte blanc)
   *   titleAccent: string|null — partie du titre en gradient animé
   *   subtitle   : string|null — sous-titre
   */
  let { badge = null, title, titleAccent = null, subtitle = null, children } = $props();
</script>

<section class="hero-section">
  <div class="hero-bg">
    <div class="aurora-blob aurora-blob-1"></div>
    <div class="aurora-blob aurora-blob-2"></div>
    <div class="aurora-blob aurora-blob-3"></div>
    <div class="dot-grid dot-grid-fade"></div>
  </div>

  <div class="hero-content">
    {#if badge}
      <div class="hero-badge">
        <span class="live-dot"></span>
        {badge}
      </div>
    {/if}

    <h1 class="hero-title">
      {title}{#if titleAccent}<br><em class="text-gradient">{titleAccent}</em>{/if}
    </h1>

    {#if subtitle}
      <p class="hero-sub">{subtitle}</p>
    {/if}

    {#if children}
      <div class="hero-actions">
        {@render children()}
      </div>
    {/if}
  </div>
</section>

<style>
  .hero-section {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--nav-h) + 72px) clamp(16px, 5vw, 80px) 64px;
    text-align: center;
  }
  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    max-width: 680px;
    width: 100%;
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    padding: 6px 16px;
    border-radius: 50px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    animation: fade-up 0.6s ease-out both;
  }
  .hero-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(2.6rem, 5.5vw, 4.8rem);
    font-weight: 900;
    letter-spacing: -3px;
    line-height: 1.05;
    color: var(--text);
    animation: fade-up 0.7s 0.1s ease-out both;
  }
  .hero-title em { font-style: normal; display: inline-block; }
  .hero-sub {
    font-size: clamp(0.88rem, 1.8vw, 1.05rem);
    color: var(--mid);
    max-width: 420px;
    line-height: 1.65;
    animation: fade-up 0.7s 0.2s ease-out both;
  }
  .hero-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    animation: fade-up 0.7s 0.3s ease-out both;
  }
  @media (max-width: 600px) {
    .hero-section { padding-top: calc(var(--nav-h) + 40px); padding-bottom: 40px; }
    .hero-title { letter-spacing: -2px; }
    .hero-actions { flex-direction: column; width: 100%; }
    .hero-actions :global(.btn-accent),
    .hero-actions :global(.btn-ghost) { width: 100%; justify-content: center; }
  }
</style>
