// ============================================================
// PORTFOLIO DATA — modifier ce fichier pour mettre à jour
// toutes les informations du portfolio facilement
// ============================================================

export const GITHUB_URL = 'https://github.com/Tfoucher5';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/theo-foucher-3956b52a0/';

// ─── Expériences professionnelles ───────────────────────────
export const experiences = [
    {
        id: 'daher',
        title: 'Alternance · Développement & Data Industrielle',
        date: '2025 – Actuellement',
        company: 'DAHER LOGISTICS',
        location: 'Montoir-de-Bretagne (44)',
        type: 'Alternance',
        current: true,
        shortDesc: "Développement from scratch d'un outil Python pour le suivi des mallettes Kardex et optimisation de flux industriels.",
        longDesc: "Au sein du pôle IT de DAHER LOGISTICS, je conçois des outils pragmatiques orientés données pour répondre à des besoins terrain concrets. L'enjeu principal est de fiabiliser les process logistiques via l'automatisation et l'analyse.",
        details: [
            "Conception et développement from scratch d'un moteur de tracking Python/Pandas pour les équipements Kardex",
            "Maintenance et amélioration continue d'outils métier critiques en VBA et Access",
            "Analyse des flux logistiques, identification des goulots d'étranglement et optimisation ROI",
            "Collaboration directe avec les équipes terrain pour la définition et le cadrage des besoins"
        ],
        stack: ['Python', 'Pandas', 'VBA', 'Access', 'Excel']
    },
    {
        id: 'wiklog',
        title: "Stage · Refonte Outil Web Logistique",
        date: '2024',
        company: 'WIKLOG',
        location: 'La Baule (44)',
        type: 'Stage',
        current: false,
        shortDesc: "Transformation d'un Excel en application Web fluide, responsive et mobile-first avec Laravel.",
        longDesc: "Chez WIKLOG, j'ai mené de bout en bout la refonte d'un outil de gestion logistique utilisé quotidiennement par les équipes terrain. Le passage d'un tableur à une vraie application web a nécessité une réflexion approfondie sur l'UX et la logique métier.",
        details: [
            "Migration complète d'un outil Excel vers une application web Laravel moderne",
            "Design responsive et mobile-first avec focus sur l'ergonomie terrain et la rapidité d'exécution",
            "Travail en méthode Agile avec sprints, rétrospectives et démonstrations client régulières",
            "Optimisation des performances et refactoring de la logique métier héritée"
        ],
        stack: ['Laravel', 'PHP', 'JavaScript', 'CSS', 'MySQL']
    },
    {
        id: 'laposte',
        title: 'Stage · Développement Web',
        date: '2023',
        company: 'La Poste',
        location: 'Nantes (44)',
        type: 'Stage',
        current: false,
        shortDesc: "Transformation d'un outil Excel en application Web avec Angular (Front) et NodeJS (Back).",
        longDesc: "Premier stage significatif chez La Poste, où j'ai découvert le développement web en contexte d'entreprise. Travail en équipe sur une refonte complète d'un outil interne de gestion.",
        details: [
            "Développement frontend avec Angular pour moderniser un outil interne de gestion",
            "API backend avec NodeJS pour la gestion et la persistance des données métier",
            "Interface responsive remplaçant complètement une gestion Excel manuelle et fragile",
            "Tests, documentation technique et passation à l'équipe IT interne"
        ],
        stack: ['Angular', 'NodeJS', 'TypeScript', 'REST API', 'PostgreSQL']
    }
];

// ─── Formation / Éducation ───────────────────────────────────
// Modifie les noms d'établissements et les détails selon ta situation réelle
export const education = [
    {
        id: 'licence',
        degree: 'Bachelor / Licence Pro Informatique',
        school: '[ À compléter — Nom établissement ]',
        period: '2025 – 2026',
        location: 'Loire-Atlantique',
        description: "Formation en alternance focalisée sur le développement logiciel, la data et les outils industriels.",
        details: [
            "Développement web full-stack et architecture applicative",
            "Gestion de données, automatisation et scripts Python",
            "Projets industriels en contexte réel via alternance",
            "Méthodes Agile, DevOps et bonnes pratiques de développement"
        ]
    },
    {
        id: 'bts',
        degree: 'BTS SIO · option SLAM',
        school: '[ À compléter — Nom établissement ]',
        period: '2023 – 2025',
        location: 'Nantes',
        description: "Services Informatiques aux Organisations, spécialité Solutions Logicielles et Applications Métiers.",
        details: [
            "Développement d'applications web et logicielles",
            "Bases de données relationnelles et SQL",
            "Méthodes agiles, UML et gestion de projet",
            "Stages chez La Poste (2023) et WIKLOG (2024)"
        ]
    }
];

// ─── Compétences ─────────────────────────────────────────────
export const skills = [
    {
        title: 'Front-end',
        icon: '◈',
        description: "Création d'interfaces modernes, rapides et responsive avec une attention particulière au ressenti utilisateur.",
        items: ['SvelteKit', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Angular', 'UX/UI', 'Responsive']
    },
    {
        title: 'Back-end & Data',
        icon: '◉',
        description: "Conception d'applications orientées données, logique métier, persistance, automatisation et exploitation technique.",
        items: ['Laravel', 'NodeJS', 'Python', 'Pandas', 'PostgreSQL', 'Supabase', 'SQL', 'API REST']
    },
    {
        title: 'Industrialisation',
        icon: '◎',
        description: "Développement d'outils pragmatiques pour des environnements réels : logistique, process métier, optimisation, suivi.",
        items: ['Excel', 'VBA', 'Access', 'Automatisation', 'Analyse', 'Process', 'ROI', 'Reporting']
    }
];

// ─── Projets ─────────────────────────────────────────────────
export const projects = [
    {
        id: 'zik-music',
        title: 'Zik-Music.fr',
        tagline: 'Blind Test multijoueur en temps réel',
        shortDesc: "Projet personnel majeur : architecture moderne avec SvelteKit, base de données Supabase, logique temps réel et expérience utilisateur travaillée.",
        longDesc: "ZIK est un blind test musical multijoueur entièrement développé from scratch. Le projet couvre tous les aspects d'une vraie application web moderne : authentification, temps réel, gestion de salles, classements et profils utilisateurs. C'est mon terrain d'expérimentation principal pour tester de nouvelles architectures.",
        tags: ['SvelteKit', 'Supabase', 'PostgreSQL', 'Temps réel'],
        stack: [
            { name: 'SvelteKit', cat: 'Frontend' },
            { name: 'Svelte 5', cat: 'Frontend' },
            { name: 'Socket.IO', cat: 'Temps réel' },
            { name: 'Supabase', cat: 'Backend' },
            { name: 'PostgreSQL', cat: 'Base de données' },
            { name: 'Spotify API', cat: 'Intégration' },
            { name: 'Deezer API', cat: 'Intégration' },
            { name: 'Node.js', cat: 'Serveur' }
        ],
        highlights: [
            'Salles multijoueur en temps réel avec Socket.IO',
            'Authentification complète (email + Google OAuth)',
            'Import de playlists Spotify & Deezer',
            'Système de score, classement et profils utilisateurs',
            "Architecture full-stack avec gestion d'état avancée",
            'Déployé en production sur Vercel + serveur Node dédié'
        ],
        links: [
            { label: 'Voir le code', url: 'https://github.com/Tfoucher5/ZIK', type: 'github' },
            { label: 'zik-music.fr', url: 'https://www.zik-music.fr', type: 'live' }
        ],
        status: 'live',
        internal: false
    },
    {
        id: 'kardex',
        title: 'Moteur de Tracking Kardex',
        tagline: 'Outil data interne · DAHER LOGISTICS',
        shortDesc: "Outil interne orienté data pour le suivi des pièces, l'optimisation de cycle de vie et la réduction des pertes.",
        longDesc: "Face à une gestion des équipements Kardex dispersée dans des fichiers Excel incomplets, j'ai conçu un moteur de tracking from scratch capable d'agréger, nettoyer et analyser les données de cycle de vie des mallettes. Le résultat : une visibilité totale sur l'état du parc et des alertes préventives automatisées.",
        tags: ['Python', 'Pandas', 'Automatisation', 'Analyse'],
        stack: [
            { name: 'Python', cat: 'Core' },
            { name: 'Pandas', cat: 'Data' },
            { name: 'OpenPyXL', cat: 'Excel' },
            { name: 'Excel', cat: 'Excel' },
            { name: 'Access', cat: 'Backend' }
        ],
        highlights: [
            'Agrégation et nettoyage automatique des données multi-sources',
            'Calcul des cycles de vie et alertes de maintenance préventive',
            'Exports formatés pour les équipes terrain',
            'Réduction significative des pertes et doublons',
            "Adoption rapide par les équipes grâce à l'interface Excel familière"
        ],
        links: [],
        status: 'internal',
        internal: true
    },
    {
        id: 'wiklog-app',
        title: 'Refonte Outil Logistique Web',
        tagline: 'Migration Excel → Application Web · WIKLOG',
        shortDesc: "Passage d'une logique tableur à une application Web claire, responsive et exploitable au quotidien.",
        longDesc: "Le défi était ambitieux : transformer un Excel utilisé depuis des années en une vraie application web, sans perdre les utilisateurs en route. J'ai travaillé de façon itérative avec les équipes terrain pour comprendre les usages réels, simplifier les flux et livrer une interface mobile-first adaptée aux conditions d'utilisation logistique.",
        tags: ['Laravel', 'UX', 'Métier', 'Mobile-first'],
        stack: [
            { name: 'Laravel', cat: 'Backend' },
            { name: 'PHP', cat: 'Backend' },
            { name: 'MySQL', cat: 'Base de données' },
            { name: 'JavaScript', cat: 'Frontend' },
            { name: 'CSS', cat: 'Frontend' },
            { name: 'Blade', cat: 'Templates' }
        ],
        highlights: [
            'Migration complète Excel → application web fonctionnelle',
            'Interface mobile-first adaptée aux contraintes terrain',
            'Méthode Agile avec sprints et validation régulière',
            'Performance et logique métier optimisées dès la conception',
            'Prise en main immédiate par des utilisateurs non-tech'
        ],
        links: [],
        status: 'internal',
        internal: true
    }
];

// ─── Qualités / Méthode de travail ───────────────────────────
export const qualities = [
    {
        icon: '◈',
        title: 'Rigueur technique',
        text: "J'aime comprendre la mécanique d'un système avant de l'améliorer. Je vise des solutions propres, stables et maintenables sur le long terme."
    },
    {
        icon: '◉',
        title: "Esprit d'analyse",
        text: "Je cherche la cause racine, la cohérence métier et le meilleur compromis entre simplicité, fiabilité et performance."
    },
    {
        icon: '◎',
        title: 'Autonomie',
        text: "Je peux partir d'un besoin métier flou, clarifier le problème, structurer la solution et livrer quelque chose d'exploitable."
    },
    {
        icon: '◷',
        title: 'Vision produit',
        text: "Je pense usage concret, lisibilité, ergonomie, vitesse et valeur réelle — pas seulement à la technique pour la technique."
    }
];

// ─── Passions ────────────────────────────────────────────────
export const passions = [
    {
        title: 'Motorsport & Sim Racing',
        icon: '⬡',
        text: "Passionné d'endurance, de F1 et de philosophie mécanique. L'optimisation, la trajectoire et la précision me parlent autant sur piste qu'en développement."
    },
    {
        title: 'Gaming & Univers sandbox',
        icon: '⬡',
        text: "J'apprécie les systèmes complexes, l'expérimentation et les environnements où performance et créativité cohabitent naturellement."
    }
];

// ─── Métriques hero ──────────────────────────────────────────
export const metrics = [
    { value: 3, suffix: '+', label: 'univers techniques' },
    { value: 5, suffix: '+', label: 'projets livrés' },
    { value: 3, suffix: ' ans', label: "d'expérience terrain" }
];
