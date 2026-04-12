<svelte:head>
  <title>ZIK — Mentions Légales</title>
  <meta name="description" content="Mentions légales de ZIK, le blind test musical multijoueur en ligne. Éditeur, hébergeur et informations légales.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.zik-music.fr/mentions-legales">
</svelte:head>

<main class="legal-page">
  <button onclick={() => history.back()} class="settings-back" style="background:none;border:none;cursor:pointer;padding:0;display:inline-block;margin-bottom:24px;font-size:.82rem;color:var(--mid);font-weight:500;transition:color .15s">&larr; Retour</button>
  <h1>Mentions L&eacute;gales</h1>
  <p class="legal-date">Derni&egrave;re mise &agrave; jour&nbsp;: avril 2026</p>

  <section>
    <h2>1. &Eacute;diteur du site</h2>
    <p>Le site <strong>www.zik-music.fr</strong> est &eacute;dit&eacute; par&nbsp;:</p>
    <ul>
      <li><strong>Nom&nbsp;:</strong> Th&eacute;o Foucher</li>
      <li><strong>Statut&nbsp;:</strong> Particulier (projet personnel, non commercial)</li>
      <li><strong>Contact&nbsp;:</strong> <a href="mailto:theo@zik-music.fr">theo@zik-music.fr</a></li>
    </ul>
  </section>

  <section>
    <h2>2. H&eacute;bergement</h2>
    <p>Le site et son serveur sont h&eacute;berg&eacute;s par&nbsp;:</p>
    <ul>
      <li><strong>Railway</strong> &mdash; <a href="https://railway.app" target="_blank" rel="noopener noreferrer">railway.app</a></li>
    </ul>
    <p>La base de donn&eacute;es et l&rsquo;authentification sont assur&eacute;es par&nbsp;:</p>
    <ul>
      <li><strong>Supabase Inc.</strong> &mdash; infrastructure h&eacute;berg&eacute;e en Union Europ&eacute;enne, conforme RGPD &mdash; <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
    </ul>
  </section>

  <section>
    <h2>3. Propri&eacute;t&eacute; intellectuelle</h2>
    <p>Le code source, le design, les textes et les &eacute;l&eacute;ments graphiques de <strong>ZIK</strong> (hors contenus tiers) sont la propri&eacute;t&eacute; exclusive de Th&eacute;o Foucher. Toute reproduction, distribution ou utilisation sans autorisation pr&eacute;alable est interdite.</p>
    <p>Les extraits musicaux diffus&eacute;s dans l&rsquo;application sont fournis via l&rsquo;<strong>API YouTube</strong>. Les droits sur les &oelig;uvres musicales appartiennent &agrave; leurs auteurs, compositeurs et ayants droit respectifs. ZIK ne revendique aucun droit sur ces contenus.</p>
    <p>L&rsquo;import de playlists est possible via l&rsquo;API <strong>Deezer</strong> (disponible pour tous les utilisateurs connect&eacute;s) et via l&rsquo;API <strong>Spotify</strong> (r&eacute;serv&eacute; &agrave; l&rsquo;&eacute;diteur du site en raison des restrictions du mode d&eacute;veloppeur Spotify). Ces logos et marques sont la propri&eacute;t&eacute; de leurs soci&eacute;t&eacute;s respectives.</p>
  </section>

  <section>
    <h2>4. Donn&eacute;es personnelles</h2>
    <p>Le traitement des donn&eacute;es personnelles est d&eacute;taill&eacute; dans notre <a href="/confidentialite">Politique de confidentialit&eacute;</a>. Conform&eacute;ment au RGPD, vous disposez d&rsquo;un droit d&rsquo;acc&egrave;s, de rectification et de suppression de vos donn&eacute;es. La suppression de compte se fait directement depuis vos <a href="/settings">Param&egrave;tres</a>.</p>
  </section>

  <section>
    <h2>5. Cookies et stockage local</h2>
    <p>ZIK n&rsquo;utilise pas de cookies de suivi publicitaire. Le stockage local du navigateur est utilis&eacute; uniquement &agrave; des fins fonctionnelles (pr&eacute;f&eacute;rences, session). Pour en savoir plus, consultez notre <a href="/confidentialite">Politique de confidentialit&eacute;</a>.</p>
  </section>

  <section>
    <h2>6. Limitation de responsabilit&eacute;</h2>
    <p>ZIK est un service fourni &laquo;&thinsp;tel quel&thinsp;&raquo;. L&rsquo;&eacute;diteur ne saurait &ecirc;tre tenu responsable des interruptions de service, pertes de donn&eacute;es, ou de tout dommage li&eacute; directement ou indirectement &agrave; l&rsquo;utilisation du site.</p>
    <p>Les liens externes pr&eacute;sents sur le site (YouTube, Spotify, Deezer) redirigent vers des services tiers soumis &agrave; leurs propres conditions d&rsquo;utilisation et politiques de confidentialit&eacute;. ZIK n&rsquo;exerce aucun contr&ocirc;le sur ces services.</p>
  </section>

  <section>
    <h2>7. Droit applicable</h2>
    <p>Les pr&eacute;sentes mentions l&eacute;gales sont r&eacute;gies par le droit fran&ccedil;ais. Tout litige relatif &agrave; l&rsquo;utilisation du site sera soumis &agrave; la comp&eacute;tence des tribunaux fran&ccedil;ais.</p>
  </section>

  <section>
    <h2>8. Contact</h2>
    <p>Pour toute question relative aux pr&eacute;sentes mentions l&eacute;gales&nbsp;: <a href="mailto:theo@zik-music.fr">theo@zik-music.fr</a> ou via <a href="https://github.com/Tfoucher5/ZIK/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>.</p>
  </section>
</main>

<style>
.legal-page {
  max-width: 720px;
  margin: 0 auto;
  padding: calc(var(--nav-h) + 32px) 24px 80px;
}
.legal-page h1 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
.legal-date { font-size: 0.8rem; color: var(--dim); margin-bottom: 40px; }
.legal-page section { margin-bottom: 32px; }
.legal-page h2 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text);
}
.legal-page p, .legal-page li { font-size: 0.9rem; color: var(--mid); line-height: 1.7; }
.legal-page ul { padding-left: 20px; margin: 8px 0; }
.legal-page li { margin-bottom: 4px; }
.legal-page a { color: var(--accent); }
.legal-page code {
  font-size: 0.82rem;
  background: rgb(var(--c-glass) / 0.05);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
}
</style>
