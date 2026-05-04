// ============================================================
// PORTFOLIO DATA — modifier ce fichier pour mettre à jour
// toutes les informations du portfolio facilement
// ============================================================

export const GITHUB_URL = "https://github.com/Tfoucher5";
export const LINKEDIN_URL =
  "https://www.linkedin.com/in/theo-foucher-3956b52a0/";
export const VERSION = "v1.1.0";

// ─── Expériences professionnelles ───────────────────────────
export const experiences = [
  {
    id: "daher",
    title: "Alternance · Développement & Data Industrielle",
    date: "du 25/08/2025 à Actuellement",
    company: "DAHER LOGISTICS",
    location: "Montoir-de-Bretagne (44)",
    type: "Alternance",
    current: true,
    shortDesc:
      "Développement from scratch d'un outil Python pour le suivi des mallettes Kardex et optimisation de flux industriels.",
    longDesc:
      "Au sein de DAHER LOGISTICS, je conçois des outils pragmatiques orientés données pour répondre à des besoins terrain concrets. L'enjeu principal est de fiabiliser les process logistiques via l'automatisation et l'analyse.",
    details: [
      "Conception et développement from scratch d'un moteur de tracking Python/Pandas pour les équipements Kardex",
      "Maintenance et amélioration continue d'outils métier critiques en VBA et Access",
      "Analyse des flux logistiques, identification des goulots d'étranglement et optimisation ROI",
    ],
    stack: ["Python", "Pandas", "VBA", "Access", "Excel"],
  },
  {
    id: "wiklog",
    title: "Stage · Refonte Outil Web",
    date: "du 23/12/2024 au 31/01/2025",
    company: "WIKLOG",
    location: "La Baule (44)",
    type: "Stage - 6 semaines",
    current: false,
    shortDesc:
      "Transformation d'un Excel en application Web fluide, responsive et mobile-first avec Laravel.",
    longDesc:
      "Chez WIKLOG, j'ai mené de bout en bout la refonte d'un outil de gestion du temps, utilisé quotidiennement par les équipes terrain. Le passage d'un tableur à une vraie application web a nécessité une réflexion approfondie sur l'UX et la logique métier.",
    details: [
      "Migration complète d'un tableur Excel sans Macros vers une application web Laravel moderne",
      "Design responsive et mobile-first avec focus sur l'ergonomie et la rapidité d'exécution",
      "Travail en méthode Agile avec sprints, rétrospectives et démonstrations client régulières",
      "Optimisation des performances et refactoring de la logique métier héritée",
    ],
    stack: ["Laravel", "PHP", "JavaScript", "CSS", "MySQL"],
  },
  {
    id: "laposte",
    title: "Stage · Développement Web",
    date: "du 10/06/2024 au 19/07/2024",
    company: "La Poste",
    location: "Nantes (44)",
    type: "Stage",
    current: false,
    shortDesc:
      "Transformation d'un outil Excel en application Web avec Angular (Front) et NodeJS (Back).",
    longDesc:
      "Premier stage significatif chez La Poste, où j'ai découvert le développement web en contexte d'entreprise. Travail 'en équipe' sur une refonte complète d'un outil interne de gestion.",
    details: [
      "Développement frontend avec Angular pour moderniser un outil interne de gestion",
      "API backend avec NodeJS pour la gestion et la persistance des données métier",
      "Interface responsive remplaçant complètement une gestion Excel manuelle et fragile",
      "Création d'une nouvelle table dans la Base De Données Oracle",
    ],
    stack: ["Angular", "NodeJS", "TypeScript", "REST API", "PostgreSQL"],
  },
];

// ─── Formation / Éducation ───────────────────────────────────
// Modifie les noms d'établissements et les détails selon ta situation réelle
export const education = [
  {
    id: "licence",
    degree:
      "Licence STS mention informatique parcours Informatique générale - coloration Développement",
    school: "Institut d'informatique Appliquée",
    period: "2025 – 2026",
    location: "Saint-Nazaire (44)",
    description:
      "Formation en alternance focalisée sur le développement logiciel et le réseau.",
    details: [
      "paradigmes de programmation, programmation avancée",
      "Systèmes d'information et Bases de données",
      "Management de projet | Planification, organisation...",
      "Cyberstructure de l'internet: réseau et sécurité",
    ],
  },
  {
    id: "bts",
    degree: "BTS SIO · option SLAM",
    school: "Institut d'informatique Appliquée",
    period: "2023 – 2025",
    location: "Saint-Nazaire (44)",
    description:
      "Services Informatiques aux Organisations, spécialité Solutions Logicielles et Applications Métiers.",
    details: [
      "Développement d'applications web et logicielles sécurisées",
      "Bases de données relationnelles et SQL",
      "Méthodes agiles, UML et gestion de projet",
      "Stages chez La Poste (2023) et WIKLOG (2024)",
    ],
  },
];

// ─── Compétences ─────────────────────────────────────────────
export const skills = [
  {
    title: "Front-end",
    icon: "◈",
    description:
      "Création d'interfaces modernes, rapides et responsive avec une attention particulière au ressenti utilisateur.",
    items: [
      "SvelteKit",
      "JavaScript",
      "TypeScript",
      "HTML",
      "CSS",
      "Angular",
      "UX/UI",
      "Responsive",
    ],
  },
  {
    title: "Back-end & Data",
    icon: "◉",
    description:
      "Conception d'applications orientées données, logique métier, persistance, automatisation et exploitation technique.",
    items: [
      "Laravel",
      "NodeJS",
      "Python",
      "Pandas",
      "PostgreSQL",
      "Supabase",
      "SQL",
    ],
  },
  {
    title: "Industrialisation",
    icon: "◎",
    description:
      "Développement d'outils pragmatiques pour des environnements réels : logistique, process métier, optimisation, suivi.",
    items: ["Excel", "VBA", "Access", "Automatisation", "Analyse", "Reporting"],
  },
];

// ─── Projets ─────────────────────────────────────────────────
export const projects = [
  {
    id: "zik-music",
    title: "Zik-Music.fr",
    tagline: "Blind Test multijoueur en temps réel",
    shortDesc:
      "Projet personnel majeur : architecture moderne avec SvelteKit, base de données Supabase, logique temps réel et expérience utilisateur travaillée.",
    longDesc:
      "ZIK est un blind test musical multijoueur entièrement développé from scratch. Le projet couvre tous les aspects d'une vraie application web moderne : authentification, temps réel, gestion de salles, classements et profils utilisateurs. C'est mon terrain d'expérimentation principal pour tester de nouvelles architectures.",
    tags: ["SvelteKit", "Supabase", "PostgreSQL", "Temps réel"],
    stack: [
      { name: "SvelteKit", cat: "Frontend" },
      { name: "Svelte 5", cat: "Frontend" },
      { name: "Socket.IO", cat: "Temps réel" },
      { name: "Supabase", cat: "Backend" },
      { name: "PostgreSQL", cat: "Base de données" },
      { name: "Spotify API", cat: "Intégration" },
      { name: "Deezer API", cat: "Intégration" },
      { name: "Node.js", cat: "Serveur" },
    ],
    highlights: [
      "Salles multijoueur en temps réel avec Socket.IO",
      "Authentification complète (email + Google OAuth)",
      "Import de playlists Spotify & Deezer",
      "Système de score, classement et profils utilisateurs",
      "Architecture full-stack avec gestion d'état avancée",
      "Déployé en production sur Railway",
    ],
    links: [
      {
        label: "Voir le code",
        url: "https://github.com/Tfoucher5/ZIK",
        type: "github",
      },
      { label: "zik-music.fr", url: "https://www.zik-music.fr", type: "live" },
    ],
    status: "live",
    internal: false,
  },
  {
    id: "guess-rater",
    title: "guess-rater",
    tagline: "Librairie npm de fuzzy matching & normalisation de chaînes",
    shortDesc:
      "Librairie JavaScript ultra-légère (0 dépendance) pour comparer et scorer des chaînes : distance de Levenshtein + normalisation configurable, utilisable partout (Node, navigateur, frameworks).",
    longDesc:
      "guess-rater est un moteur de comparaison de chaînes de caractères conçu pour produire un score de similarité robuste dans des cas réels (accents, casse, tirets, espaces, variantes d’écriture…). Il combine une normalisation configurable et un calcul basé sur la distance de Levenshtein afin de fournir un score simple à exploiter. L’API est volontairement minimale et orientée produit : calcul de score (getSimilarityScore) et validation par seuil (isMatch), pratique pour la recherche “tolérante”, la validation de saisie, ou le scoring de réponses utilisateur.",
    tags: [
      "JavaScript",
      "npm",
      "Open-Source",
      "String similarity",
      "Levenshtein",
    ],
    stack: [
      { name: "JavaScript (Vanilla)", cat: "Core" },
      { name: "Node.js", cat: "Runtime" },
      { name: "npm", cat: "Distribution" },
      { name: "Levenshtein", cat: "Algorithmie" },
      { name: "Normalisation de texte", cat: "Traitement" },
      { name: "GitHub Actions (workflows)", cat: "CI" },
    ],
    highlights: [
      "Ultra-léger : aucune dépendance externe",
      "Score de similarité basé sur la distance de Levenshtein + normalisation configurable",
      "API simple : getSimilarityScore() pour scorer, isMatch() pour valider via un seuil",
      "Agnostique : fonctionne en navigateur comme côté serveur (Node) et dans tous les frameworks",
      "Conçu pour être extensible (normalisation et règles adaptables)",
    ],
    links: [
      {
        label: "Voir le code",
        url: "https://github.com/Tfoucher5/guess-rater",
        type: "github",
      },
      {
        label: "Package npm",
        url: "https://www.npmjs.com/package/guess-rater",
        type: "npm",
      },
    ],
    status: "live",
    internal: false,
  },
  {
    id: "kardex",
    title: "Moteur de Tracking Kardex",
    tagline: "Outil data interne · DAHER LOGISTICS",
    shortDesc:
      "Outil interne orienté data pour le suivi des pièces, l'optimisation de cycle de vie et la réduction des pertes.",
    longDesc:
      "J’ai développé un outil dédié aux mallettes gérées dans les Kardex (tours de stockage vertical pour petites pièces). À partir des fichiers de données extraits automatiquement, l’application affiche — via un simple scan de la mallette — tous les godets associés ainsi que leur dernière date de vidage. Avant, tous les godets “en lot” étaient systématiquement vidés tous les 6 mois, faute d’historique fiable : cela entraînait le jet inutile de pièces parfois coûteuses. L’outil identifie désormais les godets réellement à vider, met en évidence ceux à traiter, et enregistre instantanément les validations. Résultat : une réduction nette des pertes et des économies significatives pour Airbus.",
    tags: ["Python", "Pandas", "Automatisation", "Analyse"],
    stack: [
      { name: "Python", cat: "Core" },
      { name: "Pandas", cat: "Data" },
      { name: "OpenPyXL", cat: "Excel" },
    ],
    highlights: [
      "Affichage instantané des godets d’une mallette via scan du code-barres",
      "Suivi fiable des dates de dernier vidage des godets",
      "Identification automatique des godets réellement à vider selon les règles de gestion",
      "Mise à jour en un clic et enregistrement direct dans le Kardex concerné",
      "Suppression du vidage systématique semestriel et réduction des pertes pièces",
      "Économies significatives grâce à une gestion précise des godets lottés",
    ],
    links: [],
    status: "internal",
    internal: true,
  },
  {
    id: "wiklog-app",
    title: "Refonte Outil Logistique Web",
    tagline: "Migration Excel → Application Web · WIKLOG",
    shortDesc:
      "Passage d'une logique tableur à une application Web claire, responsive et exploitable au quotidien.",
    longDesc:
      "Dans l’association sportive USGPH, deux employés saisissaient leurs heures dans un fichier Excel, mais le suivi était souvent incomplet ou incohérent — l’un d’eux travaillait même beaucoup trop sans que cela soit identifié à temps. J’ai donc dans le cadre de mon stage, conçu une application web permettant au gérant de créer et ajuster un planning précis pour chaque employé. De leur côté, les employés visualisent leurs tâches et peuvent les valider d’un simple clic une fois réalisées. Cette approche réduit les erreurs de saisie, évite les heures supplémentaires non contrôlées et offre au gérant une vision claire du travail réellement effectué.",
    tags: ["Laravel", "UX", "Métier", "Mobile-first"],
    stack: [
      { name: "Laravel", cat: "Backend" },
      { name: "PHP", cat: "Backend" },
      { name: "MySQL", cat: "Base de données" },
      { name: "JavaScript", cat: "Frontend" },
      { name: "CSS", cat: "Frontend" },
      { name: "Blade", cat: "Templates" },
    ],
    highlights: [
      "Transformation d’un suivi Excel manuel en une application web moderne",
      "Création d’un planning dynamique ajustable par le gérant",
      "Visualisation claire des tâches pour chaque employé",
      "Validation des tâches en un clic pour réduire erreurs et oublis",
      "Suivi fiable des heures réellement effectuées",
      "Prévention des heures supplémentaires non contrôlées",
      "Amélioration de la transparence et de la gestion au sein de l’association",
    ],
    links: [],
    status: "internal",
    internal: true,
  },
];

// ─── Qualités / Méthode de travail ───────────────────────────
export const qualities = [
  {
    icon: "◈",
    title: "Rigueur technique",
    text: "J'aime comprendre la mécanique d'un système avant de l'améliorer. Je vise des solutions propres, stables et maintenables sur le long terme.",
  },
  {
    icon: "◉",
    title: "Esprit d'analyse",
    text: "Je cherche la cause racine, la cohérence métier et le meilleur compromis entre simplicité, fiabilité et performance.",
  },
  {
    icon: "◎",
    title: "Autonomie",
    text: "Je peux partir d'un besoin métier flou, clarifier le problème, structurer la solution et livrer quelque chose d'exploitable.",
  },
  {
    icon: "◷",
    title: "Vision produit",
    text: "Je pense usage concret, lisibilité, ergonomie, vitesse et valeur réelle.",
  },
];

// ─── Passions ────────────────────────────────────────────────
export const passions = [
  {
    title: "Motorsport & Sim Racing",
    icon: "⬡",
    text: "Passionné d'endurance, de F1 et de Voitures en général. L'optimisation, la trajectoire et la précision me parlent autant sur piste qu'en développement.",
  },
  {
    title: "Musique : Une Vie au Rythme des Sons",
    icon: "⬡",
    text: "Impossible de vivre sans musique : j'écoute de tous les genres. Très présent sur les événements de musique électronique, cette passion est pour moi une source constante de dynamisme et de partage.",
  },
];

// ─── Métriques hero ──────────────────────────────────────────
export const metrics = [
  { value: 5, suffix: "+", label: "projets livrés" },
  { value: 2, suffix: " ", label: "stages en Entrprise" },
  { value: 1, suffix: " an", label: "en Alternance" },
];
