<script>
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "ZIK vs Blindtest.io — Comparaison des blind tests en ligne",
    "description": "ZIK et Blindtest.io sont deux blind tests musicaux en ligne. Comparaison factuelle : playlists personnalisées, modes de jeu, classement ELO, Mode Salon.",
    "url": "https://www.zik-music.fr/vs/blindtest-io",
    "inLanguage": "fr-FR",
    "isPartOf": { "@type": "WebSite", "url": "https://www.zik-music.fr/", "name": "ZIK" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.zik-music.fr/" },
        { "@type": "ListItem", "position": 2, "name": "ZIK vs Blindtest.io", "item": "https://www.zik-music.fr/vs/blindtest-io" }
      ]
    }
  });

  // eslint-disable-next-line no-unused-vars
  const ld = jsonLd;
</script>

<svelte:head>
  <title>ZIK vs Blindtest.io — Comparaison des blind tests musicaux en ligne</title>
  <meta name="description" content="ZIK ou Blindtest.io ? Comparaison factuelle : ZIK propose l'import Spotify/Deezer, un classement ELO compétitif et un Mode Salon pour les soirées. Gratuit, sans inscription." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/vs/blindtest-io" />
  <meta property="og:title" content="ZIK vs Blindtest.io — Comparaison blind test en ligne" />
  <meta property="og:description" content="ZIK et Blindtest.io sont deux blind tests musicaux en ligne. ZIK permet l'import de playlists Spotify/Deezer et propose un Mode Salon pour les soirées." />
  <meta property="og:url" content="https://www.zik-music.fr/vs/blindtest-io" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.zik-music.fr/og.png" />
  <script type="application/ld+json">{@html ld}</script>
</svelte:head>

<main class="vs-page">
  <div class="vs-back">
    <a href="/">← Retour à ZIK</a>
  </div>

  <article class="vs-article">

    <header class="vs-header">
      <div class="vs-logos">
        <span class="vs-logo-zik">ZIK</span>
        <span class="vs-separator">vs</span>
        <span class="vs-logo-other">Blindtest.io</span>
      </div>
      <h1>ZIK vs Blindtest.io : quel blind test en ligne choisir ?</h1>
      <p class="vs-intro">
        ZIK et Blindtest.io sont deux plateformes de blind test musical en ligne.
        Cette comparaison présente leurs différences de façon factuelle pour vous aider à choisir
        selon votre usage.
      </p>
    </header>

    <section class="vs-section">
      <h2>Ce que fait ZIK</h2>
      <p>
        ZIK est un blind test musical multijoueur en temps réel avec trois modes de jeu :
      </p>
      <ul>
        <li><strong>Mode Classique</strong> — saisie libre du titre et de l'artiste, classement ELO compétitif</li>
        <li><strong>Mode QCM</strong> — 4 propositions à choix multiple, sans pression</li>
        <li><strong>Mode Salon</strong> — hôte sur grand écran, joueurs sur smartphone (QR code / code)</li>
      </ul>
      <p>
        ZIK permet d'importer des playlists depuis Spotify et Deezer, ou de créer des playlists manuellement.
        Rooms publiques, privées et rooms officielles thématiques disponibles.
      </p>
    </section>

    <section class="vs-section">
      <h2>Ce que fait Blindtest.io</h2>
      <p>
        Blindtest.io est un blind test musical en ligne permettant de jouer à partir d'extraits musicaux.
        La plateforme propose des thèmes et catégories musicales prédéfinis.
      </p>
      <p>
        Cette comparaison est basée sur les informations publiquement disponibles. Si des fonctionnalités
        ont évolué, ZIK ne saurait en être tenu responsable.
      </p>
    </section>

    <section class="vs-section">
      <h2>Comparaison rapide</h2>
      <div class="vs-table-wrap">
        <table class="vs-table">
          <thead>
            <tr>
              <th>Fonctionnalité</th>
              <th>ZIK</th>
              <th>Blindtest.io</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Import playlists Spotify / Deezer</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Multijoueur en temps réel</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Classement ELO compétitif</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Mode Salon (TV + smartphones)</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Mode QCM</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Rooms privées avec code</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Sans inscription obligatoire</td><td class="yes">✓</td><td class="partial">Variable</td></tr>
            <tr><td>Entièrement gratuit</td><td class="yes">✓</td><td class="partial">Variable</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="vs-section">
      <h2>Quand choisir ZIK ?</h2>
      <ul>
        <li>Vous voulez utiliser vos propres playlists Spotify ou Deezer</li>
        <li>Vous cherchez un classement ELO compétitif persistant</li>
        <li>Vous organisez une soirée et voulez un Mode Salon (TV + smartphones)</li>
        <li>Vous voulez une expérience multijoueur en temps réel, gratuite et sans inscription</li>
      </ul>
    </section>

    <div class="vs-cta">
      <p>ZIK est conçu pour le blind test musical multijoueur. Essayez-le gratuitement.</p>
      <a href="/" class="vs-cta-btn">Jouer sur ZIK →</a>
    </div>

  </article>
</main>

<style>
  .vs-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 48px clamp(16px, 5vw, 48px) 80px;
  }
  .vs-back a {
    font-size: 0.82rem;
    color: var(--accent);
    font-weight: 600;
    opacity: 0.8;
    transition: opacity 0.15s;
  }
  .vs-back a:hover { opacity: 1; }
  .vs-back { margin-bottom: 32px; }
  .vs-header { margin-bottom: 40px; }
  .vs-logos {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .vs-logo-zik {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--accent);
  }
  .vs-separator { font-size: 1rem; font-weight: 700; color: var(--dim); }
  .vs-logo-other {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--mid);
  }
  .vs-article h1 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.5rem, 3vw, 2.2rem);
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.2;
    margin-bottom: 16px;
  }
  .vs-intro { font-size: 0.92rem; color: var(--mid); line-height: 1.7; }
  .vs-section {
    margin-bottom: 36px;
    padding-bottom: 36px;
    border-bottom: 1px solid var(--border);
  }
  .vs-section:last-of-type { border-bottom: none; }
  .vs-section h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.15rem;
    font-weight: 800;
    margin-bottom: 14px;
    color: var(--text);
  }
  .vs-section p { font-size: 0.88rem; color: var(--mid); line-height: 1.7; margin-bottom: 10px; }
  .vs-section ul { padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .vs-section li {
    font-size: 0.88rem;
    color: var(--mid);
    line-height: 1.6;
    padding-left: 18px;
    position: relative;
  }
  .vs-section li::before { content: "→"; position: absolute; left: 0; color: var(--accent); font-weight: 700; }
  .vs-table-wrap { overflow-x: auto; }
  .vs-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  .vs-table th, .vs-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  .vs-table thead th {
    font-weight: 700; font-size: 0.78rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--dim); background: rgb(var(--c-glass) / 0.04);
  }
  .vs-table td:first-child { color: var(--text); }
  .yes { color: #4ade80; font-weight: 700; }
  .no  { color: #f87171; font-weight: 700; }
  .partial { color: #fbbf24; font-weight: 700; }
  .vs-cta {
    margin-top: 48px;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
  }
  .vs-cta p { font-size: 0.92rem; color: var(--mid); margin-bottom: 16px; }
  .vs-cta-btn {
    display: inline-block;
    background: var(--accent);
    color: #000;
    font-weight: 800;
    font-family: "Bricolage Grotesque", sans-serif;
    padding: 12px 28px;
    border-radius: 10px;
    font-size: 0.92rem;
    transition: opacity 0.15s;
  }
  .vs-cta-btn:hover { opacity: 0.85; }
</style>
