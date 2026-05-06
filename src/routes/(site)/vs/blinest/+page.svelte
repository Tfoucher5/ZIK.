<script>
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "ZIK vs Blinest — Comparaison des blind tests musicaux en ligne",
    "description": "ZIK et Blinest sont deux blind tests musicaux en ligne. Comparaison factuelle : playlists personnalisées, modes de jeu, classement ELO, Mode Salon.",
    "url": "https://www.zik-music.fr/vs/blinest",
    "inLanguage": "fr-FR",
    "isPartOf": { "@type": "WebSite", "url": "https://www.zik-music.fr/", "name": "ZIK" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.zik-music.fr/" },
        { "@type": "ListItem", "position": 2, "name": "ZIK vs Blinest", "item": "https://www.zik-music.fr/vs/blinest" }
      ]
    }
  });
</script>

<svelte:head>
  <title>ZIK vs Blinest — Comparaison des blind tests musicaux en ligne</title>
  <meta name="description" content="ZIK ou Blinest pour votre prochain blind test musical ? Comparaison factuelle : playlists Spotify/Deezer personnalisées sur ZIK, classement ELO compétitif, Mode Salon pour les soirées." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/vs/blinest" />
  <meta property="og:title" content="ZIK vs Blinest — Comparaison blind test musical" />
  <meta property="og:description" content="ZIK et Blinest sont deux blind tests musicaux en ligne. ZIK permet d'importer ses propres playlists Spotify/Deezer et propose un Mode Salon pour les soirées." />
  <meta property="og:url" content="https://www.zik-music.fr/vs/blinest" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.zik-music.fr/og.png" />
  <script type="application/ld+json">{@html jsonLd}</script>
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
        <span class="vs-logo-other">Blinest</span>
      </div>
      <h1>ZIK vs Blinest : deux blind tests musicaux, des approches différentes</h1>
      <p class="vs-intro">
        ZIK et Blinest sont deux blind tests musicaux en ligne gratuits, tous deux francophones.
        Cette comparaison présente leurs différences de façon factuelle, pour vous aider à choisir
        selon votre usage.
      </p>
    </header>

    <section class="vs-section">
      <h2>Ce que fait ZIK</h2>
      <p>
        ZIK est un blind test musical multijoueur en temps réel. Il se distingue par :
      </p>
      <ul>
        <li>L'import de playlists personnalisées depuis Spotify et Deezer</li>
        <li>Trois modes de jeu : Classique (ELO), QCM (casual), Salon (soirée TV + smartphones)</li>
        <li>Un classement ELO compétitif persistant pour les joueurs inscrits</li>
        <li>La création de rooms publiques et privées avec code partageable</li>
        <li>Jusqu'à 20 joueurs simultanément, en temps réel via Socket.io</li>
      </ul>
    </section>

    <section class="vs-section">
      <h2>Ce que fait Blinest</h2>
      <p>
        Blinest est un blind test musical en ligne basé sur des extraits de playlists Deezer.
        Le joueur écoute un extrait et doit identifier le titre parmi des propositions.
        Blinest propose différents genres musicaux (pop, rock, rap, etc.) sous forme de défis.
      </p>
      <p>
        Blinest ne permet pas d'importer ses propres playlists personnalisées, ni d'organiser
        des parties multijoueur en temps réel avec ses amis depuis une room dédiée.
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
              <th>Blinest</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Import playlists Spotify / Deezer</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Multijoueur en temps réel</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Classement ELO compétitif</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Mode Salon (TV + smartphones)</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Mode QCM</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Blind test solo / défis par genre</td><td class="partial">Partiel</td><td class="yes">✓</td></tr>
            <tr><td>Rooms privées avec code</td><td class="yes">✓</td><td class="no">✗</td></tr>
            <tr><td>Sans inscription obligatoire</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Entièrement gratuit</td><td class="yes">✓</td><td class="yes">✓</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="vs-section">
      <h2>Quand choisir ZIK plutôt que Blinest ?</h2>
      <ul>
        <li>Vous voulez jouer avec vos propres playlists Spotify ou Deezer</li>
        <li>Vous cherchez un blind test multijoueur en temps réel avec des amis</li>
        <li>Vous organisez une soirée et voulez un Mode Salon TV + smartphones</li>
        <li>Vous voulez un classement ELO compétitif et persistant</li>
      </ul>
    </section>

    <section class="vs-section">
      <h2>Quand choisir Blinest ?</h2>
      <ul>
        <li>Vous préférez jouer en solo sur des défis par genre musical prédéfinis</li>
        <li>Vous n'avez pas de playlist particulière en tête et voulez jouer directement</li>
      </ul>
    </section>

    <div class="vs-cta">
      <p>Importez vos playlists et jouez avec vos amis sur ZIK. Gratuit, sans inscription.</p>
      <a href="/" class="vs-cta-btn">Essayer ZIK →</a>
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
