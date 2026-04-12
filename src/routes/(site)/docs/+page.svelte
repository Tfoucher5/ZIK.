<script>
  import { onMount } from 'svelte';

  let activeSection = $state('decouverte');

  const sections = [
    { id: 'decouverte', label: 'Découverte' },
    { id: 'rejoindre', label: 'Rejoindre une partie' },
    { id: 'jouer', label: 'Comment jouer' },
    { id: 'points', label: 'Système de points' },
    { id: 'salon', label: 'Mode Salon' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'compte', label: 'Compte & Profil' },
    { id: 'classement', label: 'Classements' },
    { id: 'faq', label: 'FAQ' },
  ];

  onMount(() => {
    const headings = document.querySelectorAll('h2[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeSection = entry.target.id;
          }
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  });

  const jsonLdPage = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Guide complet — Blind Test ZIK",
    "url": "https://www.zik-music.fr/docs",
    "description": "Guide complet du blind test ZIK : comment jouer, système de points, Mode Salon Kahoot-like, import Spotify/Deezer, classement ELO, FAQ.",
    "inLanguage": "fr-FR",
    "isPartOf": { "@type": "WebSite", "url": "https://www.zik-music.fr/", "name": "ZIK" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.zik-music.fr/" },
        { "@type": "ListItem", "position": 2, "name": "Documentation", "item": "https://www.zik-music.fr/docs" }
      ]
    }
  });

  const jsonLdFaq = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Faut-il un compte pour jouer au blind test sur ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "Non, le mode invité permet de jouer immédiatement sans inscription, juste avec un pseudo. Créer un compte gratuit vous donne accès au classement ELO, aux statistiques personnelles et aux playlists personnalisées." } },
      { "@type": "Question", "name": "Comment rejoindre une partie de blind test en ligne sur ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "Deux façons : rejoindre une room officielle depuis la page d'accueil en cliquant sur JOUER, ou entrer un code de room partagé par un ami. Aucune installation requise, tout se passe dans le navigateur." } },
      { "@type": "Question", "name": "Comment fonctionne le système de points au blind test ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "En mode texte libre : Artiste trouvé = 1 pt + bonus vitesse, Titre trouvé = 1 pt + bonus vitesse. Le bonus vitesse va de +3 pts en moins de 3 secondes à 0 pt après 18 secondes. En Mode Salon QCM : entre 1 000 pts (réponse immédiate) et 200 pts (dernière seconde), selon la rapidité." } },
      { "@type": "Question", "name": "Qu'est-ce que le Mode Salon de ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "Le Mode Salon est un blind test à la Kahoot conçu pour les soirées, événements et salles de classe. L'hôte projette un écran de contrôle sur TV, et chaque joueur participe sur son smartphone via un QR code ou un code court. Disponible en mode texte libre ou QCM avec 4 boutons colorés." } },
      { "@type": "Question", "name": "Comment importer une playlist Deezer sur ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "Rendez-vous sur la page Playlists, cliquez sur Nouvelle playlist, puis collez le lien de votre playlist Deezer (format : https://www.deezer.com/fr/playlist/...). Les titres sont importés automatiquement. Vous pouvez ensuite créer une room de blind test basée sur cette playlist et la partager." } },
      { "@type": "Question", "name": "La saisie au blind test ZIK est-elle sensible aux accents et aux fautes de frappe ?", "acceptedAnswer": { "@type": "Answer", "text": "Non ! Le moteur de détection ignore les accents, les majuscules et tolère les petites fautes de frappe grâce à un algorithme de similarité. beyonce sera accepté pour Beyoncé, Pokr Face pour Poker Face." } },
      { "@type": "Question", "name": "Comment fonctionne le classement ELO sur ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "ZIK utilise un vrai système ELO pairwise : à la fin de chaque partie, vous êtes comparé individuellement à chaque adversaire. Battre un joueur mieux classé rapporte beaucoup, perdre contre un joueur moins bien classé coûte cher. L'ELO n'évolue que dans les rooms publiques avec au moins 3 joueurs. Il existe aussi un classement hebdomadaire qui repart à zéro chaque lundi." } },
      { "@type": "Question", "name": "Comment supprimer mon compte ZIK ?", "acceptedAnswer": { "@type": "Answer", "text": "Vous pouvez supprimer votre compte directement depuis vos Paramètres (section Zone dangereuse). La suppression est immédiate et irréversible : profil, playlists, scores et toutes vos données sont effacés instantanément." } }
    ]
  });
</script>

<svelte:head>
  <title>ZIK — Documentation | Blind Test Multijoueur</title>
  <meta name="description" content="Guide complet du blind test ZIK : comment jouer, système de points et bonus vitesse, Mode Salon Kahoot-like, import Deezer, classement ELO, FAQ. Gratuit en ligne." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/docs" />
  <meta property="og:title" content="Guide complet — Blind Test ZIK | Règles, Points, Mode Salon" />
  <meta property="og:description" content="Guide complet du blind test ZIK : comment jouer, système de points, Mode Salon Kahoot-like, import Deezer, classement ELO, FAQ." />
  <meta property="og:url" content="https://www.zik-music.fr/docs" />
  <meta name="twitter:title" content="Guide complet — Blind Test ZIK | Règles, Points, Mode Salon" />
  <meta name="twitter:description" content="Comment jouer, système de points, Mode Salon Kahoot-like, import Deezer, classement ELO, FAQ. Guide complet du blind test ZIK." />

  <script type="application/ld+json">{@html jsonLdPage}</script>
  <script type="application/ld+json">{@html jsonLdFaq}</script>
</svelte:head>

<div class="doc-root">
  <!-- Sidebar -->
  <aside class="doc-sidebar">
    <nav aria-label="Sections de la documentation">
      <ul>
        {#each sections as s (s.id)}
          <li>
            <a
              href="#{s.id}"
              class:active={activeSection === s.id}
              aria-current={activeSection === s.id ? 'location' : undefined}
            >
              {s.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>

  <!-- Main content -->
  <main class="doc-content">
    <button class="btn-back doc-back" onclick={() => history.back()}>Retour</button>

    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <a href="/">Accueil</a>
      <span class="breadcrumb-sep">/</span>
      <span>Documentation</span>
    </nav>

    <h1 class="doc-title">Documentation ZIK</h1>
    <p class="doc-subtitle">Tout ce que vous devez savoir pour jouer, créer et progresser sur ZIK — le blind test multijoueur en ligne.</p>

    <!-- ── DÉCOUVERTE ── -->
    <section>
      <h2 id="decouverte">Découverte</h2>

      <h3>Qu'est-ce que ZIK ?</h3>
      <p>
        ZIK est un <strong>blind test musical multijoueur en ligne</strong>, entièrement gratuit et sans installation. Le concept est simple : des extraits musicaux sont diffusés en temps réel, et chaque joueur doit retrouver le nom de l'artiste et le titre de la chanson le plus rapidement possible. Plus vous répondez vite et avec précision, plus vous gagnez de points.
      </p>
      <p>
        ZIK fonctionne directement dans votre navigateur — Chrome, Firefox, Safari ou Edge — sur ordinateur, tablette ou smartphone. Pas besoin de télécharger une application, pas besoin de créer un compte pour jouer en mode invité.
      </p>

      <h3>Pour qui ?</h3>
      <p>
        ZIK s'adresse à tous les amateurs de musique, des connaisseurs de tubes pop aux nostalgiques des années 80, en passant par les fans de rap, rock, électro ou jazz. Les playlists officielles couvrent un large spectre de genres et d'époques. Vous pouvez aussi créer vos propres playlists thématiques et les partager avec votre communauté.
      </p>

      <h3>Faut-il payer pour jouer ?</h3>
      <p>
        Non. ZIK est accessible sans abonnement ni paiement. L'inscription n'est pas obligatoire pour jouer, mais elle vous permet de sauvegarder vos scores, d'apparaître dans les classements ELO et de personnaliser votre profil public.
      </p>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Astuce débutant :</strong> Commencez par une room officielle "Pop française" ou "Hits 2010s" pour vous familiariser avec l'interface avant de créer et jouer dans vos propres rooms !
        </div>
      </div>
    </section>

    <!-- ── REJOINDRE ── -->
    <section>
      <h2 id="rejoindre">Rejoindre une partie</h2>

      <h3>Rooms officielles</h3>
      <p>
        Les <strong>rooms officielles</strong> sont des salles permanentes gérées par l'équipe ZIK. Elles sont toujours disponibles, avec des playlists mises à jour régulièrement. Pour y accéder, rendez-vous sur la page <a href="/rooms">Rooms</a> et cliquez sur la room de votre choix. La partie commence automatiquement dès que vous rejoignez.
      </p>

      <h3>Rejoindre par code</h3>
      <p>
        Si un ami vous partage un <strong>code de room</strong> (format : 6 caractères alphanumériques), saisissez-le dans le champ "Rejoindre par code" sur la page Rooms. Les rooms custom créées par les joueurs sont accessibles de cette façon.
      </p>

      <h3>Mode invité vs compte</h3>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Fonctionnalité</th>
            <th>Invité</th>
            <th>Compte</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jouer en room officielle</td>
            <td>✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Jouer en room custom</td>
            <td>✅</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Score sauvegardé</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Classement ELO</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Profil public</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Créer une playlist</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Créer une room custom</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Mode Salon (hôte)</td>
            <td>❌</td>
            <td>✅</td>
          </tr>
          <tr>
            <td>Mode Salon (joueur)</td>
            <td>✅</td>
            <td>✅</td>
          </tr>
        </tbody>
      </table>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Mode invité :</strong> Votre pseudo est demandé à la première connexion et stocké localement dans votre navigateur. Vos scores de session s'affichent en temps réel mais ne sont pas sauvegardés. Créez un compte gratuit pour ne rien perdre.
        </div>
      </div>

      <h3>Rejoindre le Mode Salon</h3>
      <p>
        Pour rejoindre un salon, scannez le QR code affiché sur l'écran hôte (TV ou vidéoprojecteur) ou saisissez le code à 4 chiffres manuellement sur la page <a href="/salon/play">/salon/play</a>. Aucun compte n'est nécessaire pour jouer en tant que participant.
      </p>
    </section>

    <!-- ── COMMENT JOUER ── -->
    <section>
      <h2 id="jouer">Comment jouer</h2>

      <h3>Le principe</h3>
      <p>
        À chaque manche, un extrait musical est diffusé. Votre objectif est de trouver <strong>l'artiste principal</strong> et le <strong>titre de la chanson</strong> le plus vite possible. Si la chanson comporte des artistes en featuring, chaque feat trouvé rapporte un point supplémentaire.
      </p>

      <h3>La saisie libre</h3>
      <p>
        Les réponses se font via un champ texte libre. Vous pouvez taper l'artiste et le titre dans n'importe quel ordre. Le système analyse votre saisie en continu et valide automatiquement les bonnes réponses au fur et à mesure que vous tapez.
      </p>
      <p>
        Il n'est pas nécessaire d'appuyer sur Entrée : la détection est <strong>instantanée</strong>, lettre par lettre.
      </p>

      <h3>Le système de détection</h3>
      <p>ZIK utilise un moteur de reconnaissance textuelle avancé qui gère :</p>
      <ul class="doc-list">
        <li><strong>Casse ignorée :</strong> "beyonce", "BEYONCÉ" et "Beyoncé" sont tous acceptés.</li>
        <li><strong>Accents ignorés :</strong> Pas besoin de taper les accents — "beyonce" = "Beyoncé", "daft punk" reste "Daft Punk".</li>
        <li><strong>Fautes de frappe tolérées :</strong> Le moteur utilise une distance de Levenshtein et une analyse phonétique pour accepter les approximations. "Coldplay" peut être validé si vous tapez "Coldplya" par erreur.</li>
        <li><strong>Correspondance partielle :</strong> Si votre saisie représente au moins 40% du mot attendu ET que la réponse contient ce que vous avez tapé, c'est validé. Pratique pour les titres longs.</li>
        <li><strong>Saisie courte (1-2 caractères) :</strong> La correspondance exacte est requise pour éviter les faux positifs.</li>
        <li><strong>Feats et collaborations :</strong> Tapez le nom d'un artiste en featuring pour valider ce feat séparément.</li>
      </ul>

      <h3>Messages de chauffe</h3>
      <p>
        Si votre saisie est très proche de la bonne réponse sans l'atteindre encore, le jeu affiche un message <em>"Tu chauffes !"</em> pour vous encourager. Continuez à compléter votre réponse !
      </p>

      <h3>Temps de réponse</h3>
      <p>
        Chaque manche a une durée fixée (30 secondes par défaut dans les rooms officielles, configurable en Mode Salon). Le timer s'affiche visuellement. Quand le temps est écoulé, la réponse correcte est révélée et la manche suivante démarre.
      </p>

      <div class="doc-warn">
        <span class="doc-warn-icon">⚠️</span>
        <div>
          <strong>Attention :</strong> Une fois la bonne réponse trouvée par vous-même, les points sont fixés. Si vous l'avez trouvé en premier, vous recevez aussi le bonus "premier à trouver". Mais si un autre joueur trouve avant vous, vous pouvez encore marquer des points en trouvant après — le bonus vitesse sera juste moins élevé.
        </div>
      </div>
    </section>

    <!-- ── POINTS ── -->
    <section>
      <h2 id="points">Système de points</h2>

      <h3>Points de base</h3>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Élément trouvé</th>
            <th>Points de base</th>
            <th>Bonus vitesse</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Artiste principal</td>
            <td>1 pt</td>
            <td>+ bonus (voir ci-dessous)</td>
          </tr>
          <tr>
            <td>Titre de la chanson</td>
            <td>1 pt</td>
            <td>+ bonus (voir ci-dessous)</td>
          </tr>
          <tr>
            <td>Artiste en featuring (par feat)</td>
            <td>1 pt</td>
            <td>+ bonus (voir ci-dessous)</td>
          </tr>
          <tr>
            <td>QCM Mode Salon (artiste + titre)</td>
            <td>200 – 1 000 pts</td>
            <td>Selon la vitesse de réponse (Kahoot-style)</td>
          </tr>
        </tbody>
      </table>

      <h3>Le bonus vitesse (mode texte libre)</h3>
      <p>
        En mode texte libre, un bonus vitesse récompense les joueurs qui trouvent la réponse rapidement. Il est calculé à partir du <strong>temps écoulé depuis le début de la manche</strong> et diminue progressivement. Voici des exemples concrets pour une manche de 30 secondes :
      </p>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Temps de réponse</th>
            <th>Bonus vitesse estimé</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0 – 3 secondes</td>
            <td>+3 pts</td>
          </tr>
          <tr>
            <td>3 – 8 secondes</td>
            <td>+2 pts</td>
          </tr>
          <tr>
            <td>8 – 18 secondes</td>
            <td>+1 pt</td>
          </tr>
          <tr>
            <td>18 secondes et plus</td>
            <td>+0 pt</td>
          </tr>
        </tbody>
      </table>

      <h3>Le score Kahoot (Mode Salon QCM)</h3>
      <p>
        En Mode Salon avec le QCM, le scoring fonctionne différemment : <strong>plus tu réponds vite, plus tu gagnes de points</strong>. Le score maximal est de <strong>1 000 points</strong> si tu réponds immédiatement, et il descend progressivement jusqu'à un minimum de <strong>200 points</strong> si tu réponds à la dernière seconde. Répondre faux ou ne pas répondre donne 0 point.
      </p>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Moment de réponse</th>
            <th>Points gagnés (si correct)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Immédiatement (t = 0s)</td>
            <td>1 000 pts</td>
          </tr>
          <tr>
            <td>À mi-temps (ex : 15s sur 30s)</td>
            <td>~600 pts</td>
          </tr>
          <tr>
            <td>Dernière seconde</td>
            <td>200 pts</td>
          </tr>
          <tr>
            <td>Pas de réponse / réponse incorrecte</td>
            <td>0 pt</td>
          </tr>
        </tbody>
      </table>

      <h3>Exemple de calcul concret</h3>
      <p>Prenons la chanson <em>"Poker Face"</em> de <strong>Lady Gaga</strong> :</p>
      <ul class="doc-list">
        <li>Vous trouvez l'artiste "Lady Gaga" en <strong>4 secondes</strong> → 1 pt de base + 2 pts bonus = <strong>3 pts</strong></li>
        <li>Vous trouvez le titre "Poker Face" en <strong>10 secondes</strong> → 1 pt de base + 1 pt bonus = <strong>2 pts</strong></li>
        <li>Total pour cette manche : <strong>5 pts</strong></li>
      </ul>
      <p>Maintenant avec un featuring — <em>"Partition"</em> de <strong>Beyoncé ft. Jay-Z</strong> :</p>
      <ul class="doc-list">
        <li>Artiste "Beyoncé" en 2s → 1 + 3 = <strong>4 pts</strong></li>
        <li>Titre "Partition" en 5s → 1 + 2 = <strong>3 pts</strong></li>
        <li>Feat "Jay-Z" en 12s → 1 + 1 = <strong>2 pts</strong></li>
        <li>Total pour cette manche : <strong>9 pts</strong></li>
      </ul>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Stratégie :</strong> Tapez l'artiste en premier dès que vous reconnaissez sa voix ou son style, même si vous n'avez pas encore le titre. Chaque seconde compte pour le bonus vitesse, et valider l'artiste vous libère l'esprit pour chercher le titre.
        </div>
      </div>

      <h3>Le classement en temps réel</h3>
      <p>
        Un tableau de scores s'affiche en temps réel dans la room, mis à jour après chaque validation. Le joueur avec le plus de points en tête de liste est celui qui a répondu le plus vite et le plus souvent correctement. En Mode Salon, le classement est affiché sur l'écran hôte entre chaque manche.
      </p>
    </section>

    <!-- ── SALON ── -->
    <section>
      <h2 id="salon">Mode Salon</h2>

      <h3>Qu'est-ce que le Mode Salon ?</h3>
      <p>
        Le Mode Salon est une expérience <strong>Kahoot-like</strong> conçue pour les soirées, les fêtes, les événements d'entreprise ou les salles de classe. L'hôte projette l'écran de contrôle sur une TV ou un vidéoprojecteur, et chaque participant joue sur son <strong>smartphone</strong> via un QR code ou un code à 4 chiffres.
      </p>
      <p>
        Contrairement aux rooms classiques, le Mode Salon est entièrement <strong>orchestré par l'hôte</strong> : c'est lui qui choisit la playlist, configure les paramètres, lance les manches et décide du rythme de la partie.
      </p>

      <h3>Créer un salon</h3>
      <p>Rendez-vous sur <a href="/salon">/salon</a> (compte requis). Configurez votre salon :</p>
      <ul class="doc-list">
        <li>Choisissez la <strong>playlist</strong> (vos playlists perso ou les officielles)</li>
        <li>Réglez les paramètres (voir tableau ci-dessous)</li>
        <li>Cliquez sur "Créer le salon" → vous êtes redirigé vers l'interface hôte</li>
      </ul>

      <h3>Paramètres du salon</h3>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Paramètre</th>
            <th>Valeurs possibles</th>
            <th>Défaut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Durée d'une manche</td>
            <td>15 à 60 secondes</td>
            <td>30s</td>
          </tr>
          <tr>
            <td>Nombre de manches</td>
            <td>5 à 20</td>
            <td>10</td>
          </tr>
          <tr>
            <td>Mode de réponse</td>
            <td>Texte libre ou QCM 4 choix</td>
            <td>Texte libre</td>
          </tr>
          <tr>
            <td>Avance automatique</td>
            <td>Oui / Non (hôte clique manuellement)</td>
            <td>Oui</td>
          </tr>
          <tr>
            <td>Durée de révélation</td>
            <td>3 à 15 secondes</td>
            <td>7s</td>
          </tr>
        </tbody>
      </table>

      <h3>L'écran hôte (TV / ordi)</h3>
      <p>L'écran hôte (<a href="/salon/host">/salon/host</a>) est optimisé pour être affiché en grand :</p>
      <ul class="doc-list">
        <li><strong>Lobby :</strong> QR code géant + code à 4 chiffres pour rejoindre, liste des joueurs connectés qui se met à jour en temps réel</li>
        <li><strong>Pendant la manche :</strong> Visualizer audio animé, timer géant décomptant en temps réel, titre de la manche (masqué), nombre de joueurs ayant répondu</li>
        <li><strong>Classement joueurs :</strong> Affiché avec des icônes selon le score — 🎤 (top 1), 🎸 (top 2-3), 🎵 (autres) — et mis à jour en direct</li>
        <li><strong>Révélation :</strong> La réponse s'affiche avec animation après la fin de chaque manche</li>
        <li><strong>Podium final :</strong> Top 3 animé à la fin de la partie</li>
      </ul>

      <h3>L'interface joueur (téléphone)</h3>
      <p>Les joueurs accèdent à <a href="/salon/play">/salon/play</a> sur leur smartphone :</p>
      <ul class="doc-list">
        <li><strong>Rejoindre :</strong> Scanner le QR code affiché sur l'écran hôte, ou saisir manuellement le code à 4 chiffres</li>
        <li><strong>Timer SVG :</strong> Un cercle SVG décompte le temps restant visuellement, avec changement de couleur progressif (vert → orange → rouge)</li>
        <li><strong>Mode texte libre :</strong> Champ de saisie classique, même moteur de détection que les rooms normales</li>
        <li><strong>Mode QCM :</strong> 4 boutons avec les formes emblématiques — ▲ Triangle, ◆ Losange, ● Cercle, ■ Carré — chacun avec une couleur distincte. Un seul appui suffit pour valider.</li>
        <li><strong>Suspense jusqu'à la fin :</strong> En mode QCM, la bonne réponse et les points gagnés ne sont révélés qu'à la fin du chrono ou quand tout le monde a répondu — personne ne sait si les autres ont bon avant la révélation !</li>
      </ul>

      <h3>QCM — les 4 choix</h3>
      <p>En mode QCM, les 4 options proposées incluent toujours la bonne réponse (artiste + titre) et 3 leurres générés automatiquement depuis d'autres titres de la playlist. <strong>Attention :</strong> parfois, plusieurs titres du même artiste peuvent apparaître dans les choix — il faut donc vraiment reconnaître la chanson et pas seulement l'artiste ! Les formes et couleurs sont fixes :</p>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Forme</th>
            <th>Couleur</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>▲ Triangle</td>
            <td>Rouge</td>
            <td>Haut gauche</td>
          </tr>
          <tr>
            <td>◆ Losange</td>
            <td>Bleu</td>
            <td>Haut droite</td>
          </tr>
          <tr>
            <td>● Cercle</td>
            <td>Jaune</td>
            <td>Bas gauche</td>
          </tr>
          <tr>
            <td>■ Carré</td>
            <td>Vert</td>
            <td>Bas droite</td>
          </tr>
        </tbody>
      </table>

      <h3>Reconnexion automatique</h3>
      <p>
        Si un joueur perd sa connexion réseau (tunnel, coupure Wi-Fi…), le système lui accorde une <strong>fenêtre de grâce de 90 secondes</strong>. Son score est conservé et il reprend la partie dès qu'il se reconnecte, sans avoir à ressaisir son nom ni rejoindre à nouveau.
      </p>

      <div class="doc-warn">
        <span class="doc-warn-icon">⚠️</span>
        <div>
          <strong>Important :</strong> Le salon est <strong>éphémère</strong> — il disparaît dès que l'hôte ferme l'onglet ou se déconnecte. Les scores ne sont pas sauvegardés en base de données. Pensez à noter les résultats finaux si vous souhaitez les conserver.
        </div>
      </div>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Astuce soirée :</strong> Utilisez le mode QCM avec des manches de 20 secondes pour un rythme dynamique. Activez l'avance automatique avec 5 secondes de révélation pour garder le public en haleine. Projetez l'écran hôte sur un grand écran et laissez chaque joueur utiliser son propre smartphone.
        </div>
      </div>
    </section>

    <!-- ── PLAYLISTS ── -->
    <section>
      <h2 id="playlists">Playlists</h2>

      <h3>Playlists officielles</h3>
      <p>
        L'équipe ZIK maintient un catalogue de <strong>playlists officielles</strong> couvrant tous les genres musicaux : pop, rap, rock, électro, R&B, années 80/90/2000, hits internationaux, musiques de films, et bien plus. Ces playlists sont mises à jour régulièrement pour rester actuelles. Elles apparaissent avec un badge "Officiel" et sont disponibles dans toutes les rooms officielles correspondantes.
      </p>

      <h3>Créer une playlist personnalisée</h3>
      <p>Pour créer votre propre playlist (compte requis) :</p>
      <ol class="doc-list">
        <li>Rendez-vous sur <a href="/playlists">Playlists</a> → "Créer une playlist"</li>
        <li>Donnez-lui un nom et une description</li>
        <li>Ajoutez des titres manuellement (recherche intégrée) ou importez depuis Deezer</li>
        <li>Choisissez si la playlist est publique ou privée</li>
        <li>Sauvegardez</li>
      </ol>

      <h3>Importer depuis Deezer</h3>
      <p>
        Même principe avec Deezer : copiez le lien de votre playlist Deezer (Format : <code>https://www.deezer.com/fr/playlist/...</code>) et collez-le dans le champ d'import correspondant. La synchronisation est instantanée.
      </p>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Conseil pour le Mode Salon :</strong> Créez une playlist dédiée à votre événement avant la soirée. Importez vos favoris depuis Deezer, ajustez manuellement si besoin, puis sélectionnez cette playlist lors de la création de votre salon.
        </div>
      </div>

      <h3>Partager une playlist</h3>
      <p>
        Une playlist publique est visible par tous les joueurs ZIK et peut être utilisée par n'importe qui pour créer une room custom ou un salon. Une playlist privée n'est accessible qu'à vous. Vous pouvez modifier la visibilité à tout moment depuis les paramètres de la playlist.
      </p>

      <div class="doc-warn">
        <span class="doc-warn-icon">⚠️</span>
        <div>
          <strong>Respect du droit d'auteur :</strong> Les playlists ZIK utilisent des extraits de 30 secondes conformément aux accords de licence musicale. Ne publiez pas de playlists à des fins commerciales sans autorisation.
        </div>
      </div>
    </section>

    <!-- ── ROOMS ── -->
    <section>
      <h2 id="rooms">Rooms</h2>

      <h3>Rooms officielles permanentes</h3>
      <p>
        Les rooms officielles sont des salles toujours ouvertes, accessibles 24h/24. Elles utilisent les playlists officielles ZIK et sont configurées avec des paramètres optimaux (durée de manche, difficulté). N'importe qui peut les rejoindre à tout moment — si personne ne joue, vous êtes seul jusqu'à ce qu'un autre joueur arrive.
      </p>

      <h3>Rooms custom éphémères</h3>
      <p>
        Vous pouvez créer votre propre room avec votre playlist et vos paramètres (compte requis). Les rooms custom sont <strong>éphémères</strong> : elles existent en mémoire sur le serveur et disparaissent automatiquement après <strong>4 heures d'inactivité</strong>. Le code de la room est à partager avec vos amis.
      </p>

      <h3>Rejoindre par code</h3>
      <p>
        Sur la page <a href="/rooms">Rooms</a>, un champ "Rejoindre par code" vous permet de saisir directement le code à 6 caractères d'une room custom. Utile quand votre ami vous envoie le code par message.
      </p>

      <h3>Créer sa propre room</h3>
      <ol class="doc-list">
        <li>Allez sur <a href="/rooms">Rooms</a> → "Créer une room"</li>
        <li>Choisissez une playlist (vos playlists ou les officielles)</li>
        <li>Configurez la durée des manches et les options</li>
        <li>Partagez le code généré avec vos amis</li>
      </ol>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Room vs Salon :</strong> Les rooms sont idéales pour jouer en continu avec des amis en ligne. Le Mode Salon est préférable pour les événements en présentiel avec une TV ou un vidéoprojecteur.
        </div>
      </div>
    </section>

    <!-- ── COMPTE ── -->
    <section>
      <h2 id="compte">Compte &amp; Profil</h2>

      <h3>Créer un compte</h3>
      <p>L'inscription est gratuite et prend moins d'une minute. Deux méthodes :</p>
      <ul class="doc-list">
        <li><strong>Email + mot de passe :</strong> Saisissez votre email, choisissez un pseudo et un mot de passe. Un email de confirmation est envoyé.</li>
        <li><strong>Google OAuth :</strong> Connexion en un clic avec votre compte Google, aucun mot de passe à retenir.</li>
      </ul>

      <h3>Mode invité</h3>
      <p>
        Sans compte, vous jouez en mode invité. Votre pseudo est stocké localement dans votre navigateur. Vos scores s'affichent en partie mais ne sont pas sauvegardés — à la prochaine session, vous repartez de zéro. Aucune donnée personnelle n'est collectée en mode invité.
      </p>

      <h3>Profil public</h3>
      <p>
        Chaque compte ZIK dispose d'un profil public accessible via <code>/user/[votre-pseudo]</code>. Il affiche :
      </p>
      <ul class="doc-list">
        <li><strong>Avatar DiceBear :</strong> Avatar généré automatiquement à partir de votre pseudo, unique et identifiable</li>
        <li><strong>Statistiques globales :</strong> Nombre de parties jouées, taux de bonnes réponses, score total accumulé</li>
        <li><strong>Meilleurs scores par room :</strong> Votre record personnel dans chaque room officielle</li>
        <li><strong>Rang ELO :</strong> Votre position dans le classement global</li>
      </ul>

      <h3>Confidentialité du profil</h3>
      <p>
        Vous pouvez rendre votre profil <strong>privé</strong> depuis les paramètres (<a href="/settings">Paramètres</a> → Confidentialité). Un profil privé n'apparaît pas dans les classements publics et n'est pas indexé par les moteurs de recherche.
      </p>

      <h3>Paramètres personnalisables</h3>
      <ul class="doc-list">
        <li><strong>Animations :</strong> Désactivez les animations pour améliorer les performances ou réduire les distractions visuelles</li>
        <li><strong>Volume par défaut :</strong> Réglez le volume de lecture des extraits musicaux (conservé entre les sessions)</li>
        <li><strong>Confidentialité :</strong> Profil public ou privé</li>
        <li><strong>Pseudo :</strong> Modifiable une fois toutes les 30 jours</li>
      </ul>

      <div class="doc-warn">
        <span class="doc-warn-icon">⚠️</span>
        <div>
          <strong>Sécurité :</strong> Ne partagez jamais votre mot de passe. ZIK ne vous demandera jamais votre mot de passe par email ou message. En cas de doute, utilisez la fonctionnalité "Mot de passe oublié".
        </div>
      </div>
    </section>

    <!-- ── CLASSEMENTS ── -->
    <section>
      <h2 id="classement">Classements</h2>

      <h3>ELO all-time</h3>
      <p>
        Le classement ELO est le classement de référence de ZIK. Il utilise un <strong>vrai système ELO pairwise</strong> : votre ELO évolue en fonction du niveau de chacun de vos adversaires, pas seulement de votre position finale.
      </p>
      <p>Concrètement, à la fin de chaque partie vous êtes comparé individuellement à chaque autre joueur :</p>
      <ul class="doc-list">
        <li><strong>Battre un joueur mieux classé</strong> → gros gain ELO (c'était inattendu)</li>
        <li><strong>Battre un joueur moins bien classé</strong> → petit gain ELO (c'était attendu)</li>
        <li><strong>Perdre contre un joueur mieux classé</strong> → petite perte ELO</li>
        <li><strong>Perdre contre un joueur moins bien classé</strong> → grosse perte ELO</li>
      </ul>
      <p>
        La vitesse d'évolution (K-factor) diminue avec l'expérience : les nouveaux joueurs progressent vite, les joueurs expérimentés ont un ELO plus stable. Votre ELO n'évolue que dans les <strong>rooms publiques avec au minimum 3 joueurs</strong>.
      </p>

      <h3>Classement hebdomadaire</h3>
      <p>
        En parallèle du classement ELO all-time, un <strong>classement hebdomadaire</strong> repart de zéro chaque lundi à minuit. Il prend en compte le total de points bruts accumulés durant la semaine. Il donne sa chance à tout le monde, même aux joueurs avec un ELO faible, de briller sur une semaine donnée.
      </p>

      <div class="doc-tip">
        <span class="doc-tip-icon">💡</span>
        <div>
          <strong>Progression ELO :</strong> Pour progresser efficacement, cherchez des adversaires de niveau proche ou supérieur au vôtre. Battre un joueur à 1 400 ELO quand vous êtes à 1 000 rapporte beaucoup plus que battre un débutant. Rappel : il faut une room publique avec au moins 3 joueurs.
        </div>
      </div>

      <h3>Consulter les classements</h3>
      <p>
        Les classements sont accessibles depuis la page d'accueil (section "Classements") ou directement via le menu. Votre propre rang est mis en évidence dans la liste.
      </p>
    </section>

    <!-- ── FAQ ── -->
    <section>
      <h2 id="faq">FAQ</h2>
      <p>Réponses aux questions les plus fréquentes.</p>

      <div class="faq-list">
        <details class="faq-item">
          <summary>Pourquoi ma réponse n'est pas acceptée alors qu'elle est correcte ?</summary>
          <div class="faq-body">
            <p>
              Vérifiez d'abord que vous n'avez pas inversé artiste et titre dans un champ dédié. En saisie libre, tapez d'abord l'artiste puis le titre, ou alternez. Si le problème persiste, il peut s'agir d'une orthographe alternative — essayez sans accents, sans apostrophes, ou une version simplifiée du nom. Par exemple, "The Weeknd" doit être tapé exactement ainsi (pas "Weeknd" seul). Si votre saisie est correcte et n'est toujours pas acceptée, signalez-le via le bouton de feedback en partie.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Est-ce que ZIK fonctionne sur mobile ?</summary>
          <div class="faq-body">
            <p>
              Oui, entièrement. ZIK est optimisé pour mobile (responsive design). La saisie de réponses sur clavier tactile peut être légèrement moins rapide que sur clavier physique, mais l'expérience reste complète. En Mode Salon, l'interface joueur est spécifiquement conçue pour les smartphones.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Pourquoi n'entends-je pas la musique ?</summary>
          <div class="faq-body">
            <p>
              Vérifiez d'abord que votre volume système n'est pas coupé. Ensuite, certains navigateurs bloquent la lecture automatique du son — cliquez une fois n'importe où sur la page pour "débloquer" l'audio. Sur Safari iOS, assurez-vous que le mode silencieux physique du téléphone n'est pas activé. Si le problème persiste, essayez un autre navigateur (Chrome recommandé).
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Comment fonctionne le mode invité ? Mes données sont-elles sauvegardées ?</summary>
          <div class="faq-body">
            <p>
              En mode invité, votre pseudo est stocké dans le <code>sessionStorage</code> de votre navigateur. Il disparaît à la fermeture de l'onglet. Vos scores ne sont pas sauvegardés en base de données — ils sont uniquement visibles pendant la partie en cours. Aucune donnée personnelle n'est collectée ni transmise. Pour sauvegarder vos scores, créez un compte gratuit.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Combien de personnes peuvent jouer dans un salon ?</summary>
          <div class="faq-body">
            <p>
              Il n'y a pas de limite stricte définie pour le Mode Salon. En pratique, des groupes de 5 à 50 personnes jouent sans problème. Pour des événements très larges (100+ personnes), assurez-vous que votre connexion internet (côté hôte) est stable. Le serveur gère les connexions Socket.io en temps réel.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Puis-je jouer avec mes propres chansons ?</summary>
          <div class="faq-body">
            <p>
              Pas directement depuis vos fichiers locaux. En revanche, vous pouvez importer une playlist depuis Deezer contenant vos titres favoris. ZIK utilisera ses propres extraits audio (via YouTube) pour ces titres. Si un titre n'est pas trouvé, il ne sera pas inclus dans la partie.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Mon ELO a baissé alors que j'ai bien joué — pourquoi ?</summary>
          <div class="faq-body">
            <p>
              L'ELO est relatif au niveau de vos adversaires. Si vous avez terminé derrière des joueurs moins bien classés que vous, votre ELO baisse — c'était attendu de vous. À l'inverse, perdre face à des joueurs beaucoup plus forts coûte très peu. C'est la logique du vrai système ELO : le résultat compte, mais le niveau des adversaires compte autant.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Comment changer mon pseudo ?</summary>
          <div class="faq-body">
            <p>
              Allez dans <a href="/profile">Profil</a> et cliquez sur l&rsquo;ic&ocirc;ne d&rsquo;&eacute;dition. Le changement est imm&eacute;diatement visible sur votre profil public et dans les parties. Le pseudo doit contenir entre 3 et 20 caract&egrave;res (lettres, chiffres, <code>_</code> et <code>-</code> autoris&eacute;s).
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Le Mode Salon sauvegarde-t-il les scores ?</summary>
          <div class="faq-body">
            <p>
              Non. Le Mode Salon est entièrement éphémère : les scores existent en mémoire sur le serveur pendant la durée de la session. Dès que l'hôte ferme l'onglet ou que le salon expire, tout est perdu. Si vous voulez conserver les résultats, prenez une capture d'écran du podium final affiché sur l'écran hôte.
            </p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Comment supprimer mon compte ?</summary>
          <div class="faq-body">
            <p>La suppression de votre compte se fait depuis votre page de paramètres, tout en bas, dans la section "Danger". </p><br>
            <p>⚠️ - Toute suppression du compte est définitive !</p>
          </div>
        </details>

        <details class="faq-item">
          <summary>Comment signaler un joueur ou un bug en cours de partie ?</summary>
          <div class="faq-body">
            <p>
              <strong>Signaler un joueur :</strong> cliquez sur le bouton <strong>⋯</strong> à droite du nom d'un joueur dans le classement latéral, puis choisissez « Signaler ce joueur ». Un formulaire vous invite à choisir le motif (insultes, triche, spam…) et à ajouter une description. Le signalement est anonyme.
            </p>
            <p style="margin-top:10px">
              <strong>Signaler un bug :</strong> cliquez sur le bouton <strong>🐛</strong> dans le header de la page de jeu, décrivez ce qui s'est passé et envoyez. Votre room et votre pseudo sont inclus automatiquement pour nous aider à reproduire le problème.
            </p>
            <p style="margin-top:10px">
              Vous pouvez aussi nous écrire via le lien <strong>Contact</strong> dans le footer pour toute demande ou question.
            </p>
          </div>
        </details>
      </div>
    </section>

    <div class="doc-footer-note">
      <p>Documentation mise &agrave; jour &mdash; avril 2026. Une question non couverte&nbsp;? Utilisez le <strong>formulaire de contact</strong> dans le footer ou ouvrez une <a href="https://github.com/Tfoucher5/ZIK/issues" target="_blank" rel="noopener noreferrer">issue GitHub</a>.</p>
    </div>
  </main>
</div>

<style>
  /* ── Layout global ── */
  .doc-root {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px clamp(16px, 4vw, 60px);
    min-height: 100vh;
    align-items: start;
  }

  /* ── Sidebar ── */
  .doc-sidebar {
    position: sticky;
    top: 80px;
    height: fit-content;
    padding-right: 32px;
  }

  .doc-sidebar nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .doc-sidebar nav ul li a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--dim, #888);
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
    line-height: 1.4;
  }

  .doc-sidebar nav ul li a:hover {
    color: var(--text, #fff);
    background: rgba(255, 255, 255, 0.05);
  }

  .doc-sidebar nav ul li a.active {
    color: var(--accent, #7c3aed);
    background: rgba(124, 58, 237, 0.1);
    font-weight: 600;
  }

  /* ── Contenu principal ── */
  .doc-content {
    min-width: 0;
    padding-left: 40px;
    border-left: 1px solid var(--border, rgba(255,255,255,0.08));
  }

  /* ── Bouton retour ── */
  .doc-back { margin-bottom: 20px; }

  /* ── Breadcrumb ── */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--dim, #888);
    margin-bottom: 28px;
  }

  .breadcrumb a {
    color: var(--dim, #888);
    text-decoration: none;
    transition: color 0.15s;
  }

  .breadcrumb a:hover {
    color: var(--text, #fff);
  }

  .breadcrumb-sep {
    color: var(--border, rgba(255,255,255,0.2));
  }

  /* ── Titres ── */
  .doc-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -1px;
    color: var(--text, #fff);
    margin: 0 0 12px;
    line-height: 1.15;
  }

  .doc-subtitle {
    font-size: 1rem;
    color: var(--mid, #aaa);
    margin: 0 0 48px;
    line-height: 1.65;
    max-width: 600px;
  }

  .doc-content section {
    margin-bottom: 64px;
    padding-bottom: 64px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
  }

  .doc-content section:last-of-type {
    border-bottom: none;
  }

  .doc-content h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text, #fff);
    margin: 0 0 24px;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 12px;
    scroll-margin-top: 90px;
  }

  .doc-content h3 {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text, #fff);
    margin: 32px 0 12px;
  }

  .doc-content p {
    font-size: 0.92rem;
    color: var(--mid, #ccc);
    line-height: 1.75;
    margin: 0 0 16px;
  }

  .doc-content a {
    color: var(--accent, #7c3aed);
    text-decoration: none;
  }

  .doc-content a:hover {
    text-decoration: underline;
  }

  .doc-content code {
    font-family: monospace;
    font-size: 0.82rem;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text, #fff);
  }

  /* ── Listes ── */
  .doc-list {
    padding-left: 20px;
    margin: 0 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .doc-list li {
    font-size: 0.92rem;
    color: var(--mid, #ccc);
    line-height: 1.6;
  }

  .doc-list li strong {
    color: var(--text, #fff);
  }

  ol.doc-list {
    list-style: decimal;
  }

  ul.doc-list {
    list-style: disc;
  }

  /* ── Tableaux ── */
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px;
    font-size: 0.88rem;
    border-radius: 10px;
    overflow: hidden;
  }

  .doc-table th {
    background: rgba(255,255,255,0.07);
    color: var(--text, #fff);
    font-weight: 700;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
  }

  .doc-table td {
    color: var(--mid, #ccc);
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .doc-table tr:last-child td {
    border-bottom: none;
  }

  .doc-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }

  /* ── Tip & Warn boxes ── */
  .doc-tip,
  .doc-warn {
    display: flex;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 10px;
    margin: 24px 0;
    font-size: 0.88rem;
    line-height: 1.6;
    align-items: flex-start;
  }

  .doc-tip {
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.25);
    color: var(--mid, #ccc);
  }

  .doc-warn {
    background: rgba(234, 179, 8, 0.08);
    border: 1px solid rgba(234, 179, 8, 0.25);
    color: var(--mid, #ccc);
  }

  .doc-tip-icon,
  .doc-warn-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .doc-tip strong,
  .doc-warn strong {
    color: var(--text, #fff);
    display: block;
    margin-bottom: 4px;
  }

  /* ── Badge Nouveau ── */
  .badge-new {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: var(--accent, #7c3aed);
    color: #fff;
    border-radius: 4px;
    padding: 2px 7px;
    vertical-align: middle;
    line-height: 1.6;
  }

  /* ── FAQ ── */
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }

  .faq-item {
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255,255,255,0.02);
  }

  .faq-item summary {
    padding: 16px 18px;
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text, #fff);
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    transition: background 0.15s;
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::after {
    content: '+';
    font-size: 1.2rem;
    color: var(--accent, #7c3aed);
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .faq-item[open] summary::after {
    transform: rotate(45deg);
  }

  .faq-item summary:hover {
    background: rgba(255,255,255,0.03);
  }

  .faq-body {
    padding: 0 18px 16px;
    border-top: 1px solid var(--border, rgba(255,255,255,0.06));
  }

  .faq-body p {
    margin: 12px 0 0;
    font-size: 0.9rem;
    color: var(--mid, #aaa);
    line-height: 1.7;
  }

  /* ── Footer note ── */
  .doc-footer-note {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--border, rgba(255,255,255,0.08));
    font-size: 0.8rem;
    color: var(--dim, #888);
    text-align: center;
  }

  .doc-footer-note a {
    color: var(--accent, #7c3aed);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .doc-root {
      grid-template-columns: 1fr;
      padding: 24px 16px;
    }

    .doc-sidebar {
      display: none;
    }

    .doc-content {
      padding-left: 0;
      border-left: none;
    }

    .doc-content h2 {
      font-size: 1.3rem;
    }

    .doc-title {
      font-size: 1.6rem;
    }

    .doc-table {
      font-size: 0.8rem;
    }

    .doc-table th,
    .doc-table td {
      padding: 8px 10px;
    }
  }
</style>
