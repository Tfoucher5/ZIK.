<svelte:head>
  <title>ZIK — Politique de Confidentialité</title>
  <meta name="description" content="Politique de confidentialité de ZIK, le blind test musical multijoueur en ligne. Données collectées, hébergement RGPD, droits des utilisateurs.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.zik-music.fr/confidentialite">
</svelte:head>

<main class="legal-page">
  <button onclick={() => history.back()} class="settings-back" style="background:none;border:none;cursor:pointer;padding:0;display:inline-block;margin-bottom:24px;font-size:.82rem;color:var(--mid);font-weight:500;transition:color .15s">&larr; Retour</button>
  <h1>Politique de confidentialit&eacute;</h1>
  <p class="legal-date">Derni&egrave;re mise &agrave; jour&nbsp;: avril 2026</p>

  <section>
    <h2>1. Responsable du traitement</h2>
    <p>Le responsable du traitement des donn&eacute;es personnelles collect&eacute;es sur <strong>www.zik-music.fr</strong> est Th&eacute;o Foucher.</p>
  </section>

  <section>
    <h2>2. Donn&eacute;es collect&eacute;es</h2>
    <p>Lors de la cr&eacute;ation d&rsquo;un compte, ZIK collecte les donn&eacute;es suivantes&nbsp;:</p>
    <ul>
      <li>Adresse e-mail et pseudonyme choisi</li>
      <li>Avatar (g&eacute;n&eacute;r&eacute; automatiquement via DiceBear ou t&eacute;l&eacute;vers&eacute; par l&rsquo;utilisateur)</li>
      <li>Scores de parties et statistiques de jeu (points ELO, nombre de parties, meilleurs scores)</li>
      <li>Playlists et rooms cr&eacute;&eacute;es par l&rsquo;utilisateur</li>
      <li>Pr&eacute;f&eacute;rence de confidentialit&eacute; du profil (public ou priv&eacute;)</li>
    </ul>
    <p>En mode invit&eacute;, aucune donn&eacute;e personnelle n&rsquo;est enregistr&eacute;e de fa&ccedil;on permanente en base de donn&eacute;es. Seul un pseudo temporaire est utilis&eacute; le temps de la session de jeu.</p>
    <p>En Mode Salon, les pseudos des joueurs sont &eacute;ph&eacute;m&egrave;res et ne sont jamais persist&eacute;s en base de donn&eacute;es.</p>
  </section>

  <section>
    <h2>3. Finalit&eacute;s du traitement</h2>
    <p>Vos donn&eacute;es sont utilis&eacute;es exclusivement pour&nbsp;:</p>
    <ul>
      <li>G&eacute;rer votre compte et votre authentification</li>
      <li>Afficher votre profil public (si non pass&eacute; en priv&eacute;)</li>
      <li>Calculer et afficher les classements ELO et hebdomadaires</li>
      <li>Sauvegarder vos playlists et rooms personnalis&eacute;es</li>
      <li>Afficher les statistiques de jeu sur votre profil</li>
    </ul>
    <p>Vos donn&eacute;es ne sont <strong>jamais vendues</strong> &agrave; des tiers, ni utilis&eacute;es &agrave; des fins publicitaires.</p>
  </section>

  <section>
    <h2>4. H&eacute;bergement et s&eacute;curit&eacute;</h2>
    <p>Le serveur de l&rsquo;application est h&eacute;berg&eacute; sur <strong>Railway</strong> (<a href="https://railway.app" target="_blank" rel="noopener noreferrer">railway.app</a>). Les donn&eacute;es sont h&eacute;berg&eacute;es sur <strong>Supabase</strong> (infrastructure PostgreSQL s&eacute;curis&eacute;e, conforme RGPD, h&eacute;berg&eacute;e en Union Europ&eacute;enne). L&rsquo;authentification est g&eacute;r&eacute;e par Supabase Auth, qui int&egrave;gre le chiffrement des mots de passe (bcrypt) et la gestion s&eacute;curis&eacute;e des sessions JWT.</p>
    <p>Toutes les communications entre votre navigateur et nos serveurs sont chiffr&eacute;es via <strong>HTTPS/TLS</strong>.</p>
    <p>L&rsquo;acc&egrave;s &agrave; la base de donn&eacute;es est prot&eacute;g&eacute; par des politiques de s&eacute;curit&eacute; au niveau des lignes (Row Level Security &mdash; RLS), garantissant qu&rsquo;un utilisateur ne peut acc&eacute;der qu&rsquo;&agrave; ses propres donn&eacute;es priv&eacute;es.</p>
  </section>

  <section>
    <h2>5. Cookies et stockage local</h2>
    <p>ZIK utilise le <strong>stockage local</strong> du navigateur (<code>localStorage</code> et <code>sessionStorage</code>) uniquement pour&nbsp;:</p>
    <ul>
      <li>Vos pr&eacute;f&eacute;rences d&rsquo;interface (volume par d&eacute;faut, animations activ&eacute;es ou non, th&egrave;me)</li>
      <li>Votre session de connexion Supabase (jeton d&rsquo;authentification)</li>
      <li>Votre pseudo d&rsquo;invit&eacute; pour pr&eacute;remplir le formulaire de jeu lors d&rsquo;une prochaine visite</li>
      <li>En Mode Salon&nbsp;: le code salon et le pseudo saisis lors de votre derni&egrave;re session, pour pr&eacute;remplir le formulaire. Ces donn&eacute;es restent exclusivement sur votre appareil et ne sont jamais transmises &agrave; nos serveurs.</li>
    </ul>
    <p><strong>Aucun cookie de tracking, de publicit&eacute; ou d&rsquo;analyse tiers n&rsquo;est utilis&eacute; sur ZIK.</strong></p>
  </section>

  <section>
    <h2>6. Services tiers</h2>
    <p>ZIK int&egrave;gre les services tiers suivants, chacun soumis &agrave; sa propre politique de confidentialit&eacute;&nbsp;:</p>
    <ul>
      <li><strong>YouTube IFrame API</strong> (Google LLC) &mdash; diffusion des extraits musicaux. En jouant, votre navigateur &eacute;tablit une connexion avec les serveurs de YouTube, qui peut d&eacute;poser ses propres cookies selon vos param&egrave;tres Google.</li>
      <li><strong>Deezer API</strong> &mdash; import de playlists disponible pour tous les utilisateurs connect&eacute;s (nom de la piste et artiste uniquement, aucune donn&eacute;e de lecture partag&eacute;e)</li>
      <li><strong>Spotify Web API</strong> &mdash; import de playlists r&eacute;serv&eacute; &agrave; l&rsquo;&eacute;diteur du site en raison des restrictions du mode d&eacute;veloppeur Spotify (seuls les comptes explicitement autoris&eacute;s dans le tableau de bord Spotify Developer peuvent utiliser cette fonctionnalit&eacute;)</li>
      <li><strong>DiceBear</strong> &mdash; g&eacute;n&eacute;ration d&rsquo;avatars via URL (aucune donn&eacute;e personnelle envoy&eacute;e)</li>
      <li><strong>api.qrserver.com</strong> &mdash; g&eacute;n&eacute;ration du QR code en Mode Salon (le code salon est envoy&eacute; sous forme d&rsquo;URL uniquement)</li>
    </ul>
  </section>

  <section>
    <h2>7. Vos droits (RGPD)</h2>
    <p>Conform&eacute;ment au R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD &mdash; R&egrave;glement UE 2016/679), vous disposez des droits suivants&nbsp;:</p>
    <ul>
      <li><strong>Droit d&rsquo;acc&egrave;s</strong>&nbsp;: obtenir une copie des donn&eacute;es vous concernant</li>
      <li><strong>Droit de rectification</strong>&nbsp;: corriger des donn&eacute;es inexactes (modifiable depuis le <a href="/profile">Profil</a> et les <a href="/settings">Param&egrave;tres</a>)</li>
      <li><strong>Droit &agrave; l&rsquo;effacement</strong>&nbsp;: supprimer votre compte et toutes vos donn&eacute;es</li>
      <li><strong>Droit &agrave; la portabilit&eacute;</strong>&nbsp;: obtenir vos donn&eacute;es dans un format lisible</li>
      <li><strong>Droit d&rsquo;opposition</strong>&nbsp;: vous opposer &agrave; certains traitements</li>
    </ul>
    <p><strong>Suppression de compte&nbsp;:</strong> vous pouvez supprimer votre compte directement depuis vos <a href="/settings">Param&egrave;tres</a> (section &laquo;&nbsp;Zone dangereuse&nbsp;&raquo;). La suppression est imm&eacute;diate et irr&eacute;versible&nbsp;: profil, playlists, scores et toutes les donn&eacute;es associ&eacute;es sont effac&eacute;s.</p>
    <p>Vous pouvez aussi passer votre profil en <strong>&laquo;&nbsp;Priv&eacute;&nbsp;&raquo;</strong> depuis les <a href="/settings">Param&egrave;tres</a> pour ne plus appara&icirc;tre dans les recherches publiques, sans supprimer votre compte.</p>
    <p>Si vous estimez que vos droits ne sont pas respect&eacute;s, vous pouvez d&eacute;poser une r&eacute;clamation aupr&egrave;s de la <strong>CNIL</strong> (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).</p>
  </section>

  <section>
    <h2>8. Conservation des donn&eacute;es</h2>
    <p>Les donn&eacute;es de compte sont conserv&eacute;es tant que le compte est actif. En cas de suppression de compte, toutes les donn&eacute;es personnelles associ&eacute;es sont effac&eacute;es imm&eacute;diatement. Les donn&eacute;es anonymis&eacute;es (statistiques agr&eacute;g&eacute;es sans identifiant) peuvent &ecirc;tre conserv&eacute;es &agrave; des fins statistiques.</p>
  </section>

  <section>
    <h2>9. Contact</h2>
    <p>Pour toute question relative &agrave; vos donn&eacute;es ou &agrave; la pr&eacute;sente politique&nbsp;: <a href="mailto:theo@zik-music.fr">theo@zik-music.fr</a> ou via <a href="https://github.com/Tfoucher5/ZIK/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>.</p>
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
