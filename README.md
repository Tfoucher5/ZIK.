# ZIK. 🎵

> Blind test multijoueur en temps réel — trouve les titres avant tout le monde.

[![Code Quality & Auto-Fix](https://github.com/Tfoucher5/ZIK/actions/workflows/lint.yml/badge.svg)](https://github.com/Tfoucher5/ZIK/actions/workflows/lint.yml)
[![Dependabot Status](https://img.shields.io/badge/dependabot-enabled-brightgreen.svg?logo=dependabot)](https://github.com/Tfoucher5/ZIK/network/updates)
[![SvelteKit](https://img.shields.io/badge/framework-SvelteKit-ff3e00.svg?logo=svelte)](https://kit.svelte.dev/)
[![Supabase](https://img.shields.io/badge/database-Supabase-3ecf8e.svg?logo=supabase)](https://supabase.com/)

---

## 📑 Sommaire

- [Présentation](#-présentation)
- [Fonctionnalités](#-fonctionnalités)
- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
- [Changelog](#-changelog)
- [Roadmap](#-roadmap)
- [Contribution](#-contribution)
- [Développeur](#-développeur)

---

## 📝 Présentation

**ZIK.** est une application web de **blind test multijoueur** en temps réel.

Les joueurs rejoignent une room, écoutent des extraits musicaux et tentent de trouver **l'artiste** et le **titre** le plus vite possible. Plus vite tu trouves, plus tu marques de points. Un système de classement ELO et hebdomadaire suit ta progression.

---

## ✨ Fonctionnalités

### 🎮 Gameplay

- Blind test **multijoueur synchronisé** (Socket.IO)
- Détection intelligente des réponses : similarité phonétique, accents, fautes de frappe
- Support des **artistes en featuring** (slots dynamiques)
- Timer par manche avec bonus de vitesse
- **Rooms officielles** curées + rooms personnalisées
- Rooms éphémères (4h) et rooms persistantes en base
- **Mode Salon** (Kahoot-like) : un écran hôte, les joueurs sur téléphone via QR code

### 🎵 Playlists

- Création et gestion de playlists personnalisées
- Import depuis **Spotify** (lien de playlist)
- Import depuis **Deezer** (lien de playlist)
- Playlists publiques ou privées
- Playlists officielles curées par l'équipe

### 🏆 Compétition

- Système de **points** avec bonus de vitesse
- **Classement ELO** all-time
- **Classement hebdomadaire**
- Meilleurs scores par room sur le profil

### 👤 Profil & Auth

- Inscription email / mot de passe
- Connexion **Google OAuth**
- Jeu en mode **invité** (score non sauvegardé)
- Profil personnel avec avatar, pseudo, stats et meilleurs scores
- **Profil public** : voir le profil de n'importe quel joueur connecté (`/user/[username]`)
- **Confidentialité du profil** : passer en mode Privé / Public depuis les paramètres
- Paramètres : animations, volume par défaut

### 📱 Interface

- Design **dark mode** natif avec glassmorphism et glow effects
- **Responsive mobile** — layout optimisé touch avec bouton de validation
- Rooms publiques browsables + rejoindre par code
- Navigation fluide avec animations
- Noms de joueurs **cliquables** partout (classements, scoreboard en jeu, écran de fin)
- **Footer** complet avec navigation par catégories (Jouer / Aide / Légal / Contact)
- **Signalement** : menu ⋯ sur chaque joueur en partie, bouton bug dans le header

### 🛡️ Modération & Admin

- **Formulaire de contact** accessible depuis le footer (modal, aucune navigation)
- **Signalement joueur** : motif (insultes, triche, spam, autre) + description libre, stocké en base
- **Signalement bug** : contexte de room inclus automatiquement
- **Interface admin** `/admin/reports` : protégée super_admin, filtres type/statut, actions et notes internes
- **Notifications email** instantanées pour chaque nouveau report (Resend via Edge Function Supabase)

### 📖 Documentation

- Page `/docs` complète avec 10 sections détaillées (gameplay, points, Mode Salon, playlists, FAQ…)
- Sidebar sticky avec navigation et highlight de la section active
- Indexée SEO — accessible depuis les moteurs de recherche

---

## 🛠️ Stack Technique

| Couche               | Techno                                   |
| -------------------- | ---------------------------------------- |
| **Framework**        | SvelteKit (Svelte 5 runes)               |
| **Serveur**          | Node.js + SvelteKit adapter-node         |
| **Temps réel**       | Socket.IO                                |
| **Base de données**  | Supabase (PostgreSQL + RLS)              |
| **Auth**             | Supabase Auth (email + Google OAuth)     |
| **Musique**          | YouTube IFrame API (lecture)             |
| **Import playlists** | Spotify Web API + Deezer API             |
| **Style**            | CSS vanilla (variables, dark mode natif) |
| **Email**            | Resend (via Supabase Edge Functions)     |
| **Déploiement**      | Railway (serveur Node)                   |

---

## 🏗️ Architecture

```
/
├── server.js                  # Serveur HTTP + Socket.IO
├── src/
│   ├── lib/
│   │   ├── components/        # AuthModal.svelte, Nav.svelte
│   │   ├── server/
│   │   │   ├── config.js      # Client Supabase serveur
│   │   │   ├── middleware/    # Auth JWT, rate limiting
│   │   │   ├── services/      # Spotify, Deezer, playlists
│   │   │   ├── socket/        # Logique de jeu temps réel
│   │   │   └── state.js       # État en mémoire des parties
│   │   ├── supabase.js        # Client Supabase côté client
│   │   └── utils.js           # DiceBear, escaping HTML
│   └── routes/
│       ├── +layout.svelte     # Layout global (nav, contexte auth)
│       ├── +page.svelte       # Accueil (rooms + classements)
│       ├── game/              # Interface de jeu temps réel
│       ├── docs/              # Documentation en ligne (/docs)
│       ├── salon/             # Mode Salon (setup + hôte + joueur)
│       │   ├── host/          # Écran hôte (TV/ordi) — HostCenter, PlayerSidebar
│       │   └── play/          # Interface joueur (téléphone) — JoinForm, RoundPlay, SummaryView…
│       ├── profile/           # Mon profil (édition)
│       ├── user/[username]/   # Profil public d'un joueur
│       ├── settings/          # Paramètres (visuel, jeu, confidentialité)
│       ├── rooms/             # Browsing des rooms
│       ├── playlists/         # Gestion des playlists
│       ├── cgu/               # Conditions Générales d'Utilisation
│       ├── confidentialite/   # Politique de confidentialité
│       ├── mentions-legales/  # Mentions légales (LCEN)
│       └── api/               # Endpoints REST
├── static/css/                # Styles par page
└── supabase_schema.sql        # Schéma complet de la base de données
```

---

## 📋 Changelog

### v1.4.0 — Contact, Signalements & Admin

- **Formulaire de contact** : lien dans le footer → modal (`ContactModal.svelte`) avec champs nom, email, objet, message — stocké en base et notifié par email
- **Signalement en jeu** : menu ⋯ sur chaque carte joueur → dropdown → `ReportModal` (motif + description) + bouton 🐛 dans le header pour signaler un bug
- **Table `reports`** : stockage de tous les signalements (bug, joueur, contact) avec statut, note admin, horodatage — RLS Supabase (INSERT public, lecture/modif super_admin uniquement)
- **Notifications email** : Edge Function Supabase `send-report` → Resend → email formaté avec lien vers l'interface admin
- **Interface admin** (`/admin/reports`) : page protégée super_admin avec liste dépliable des reports, filtres type/statut, boutons Résolu/Ignorer/Rouvrir, note interne
- **Refonte interface de jeu** : nouveau layout 3 colonnes glassmorphism (sidebar scores + centre + sidebar historique), pochette avec glow cinématique, slots artiste/titre redesignés, barre d'input pill avec bouton toujours visible, responsive mobile avec overlay de résumé et layout colonne
- **SEO Bing** : protocole IndexNow (clé + endpoint `/api/indexnow` protégé), GitHub Action de soumission automatique après chaque push master, sitemap étendu, robots.txt simplifié, pages légales et playlists passées en `index, follow`

### v1.3.0 — Customisation - Thèmes

- **Page Paramètres** (`/parametres`): Ajout des boutons pour sélectionner le thème d'affichage
- **Styles**: Ajout d'un fichier global pour centraliser les couleurs des thèmes

### v1.2.2 — Légal, SEO & nettoyage

- **Page Mentions Légales** (`/mentions-legales`) : conformité légale française (LCEN), informations éditeur, hébergeur, propriété intellectuelle, droits applicables
- **CGU & Confidentialité** enrichies : Spotify/Deezer détaillés, droits RGPD complets (accès, rectification, effacement, portabilité, opposition), lien CNIL, RLS Supabase mentionné
- **Footer** : lien Mentions légales ajouté dans la colonne Légal
- **SEO** : structured data enrichie (`WebSite`, `Organization`, `WebPage`, `BreadcrumbList`), Twitter Card sur toutes les pages clés, `preconnect` Google Fonts gstatic, keywords étendus
- **Sitemap** : `/rooms` et `/mentions-legales` ajoutés
- **robots.txt** : règles simplifiées et nettoyées
- **Nettoyage** : suppression du répertoire `public/css/` (doublon mort de `static/css/`)

### v1.2.1 — Documentation, footer & polish UI

- **Page `/docs`** : documentation complète en ligne avec 10 sections, sidebar sticky, highlight de section active via `IntersectionObserver`, tableaux, tip/warn boxes, FAQ — indexée SEO
- **Footer repensé** : 4 colonnes (Jouer / Aide / Légal / Brand), responsive, version affichée
- **Redesign UI Mode Salon** : timer SVG arc animé (play), QCM style Kahoot (▲◆●■) avec gradients et glow, feedback overlay glassmorphism + `backdrop-filter: blur()`, visualizer 18 barres, glow dynamique sur le big timer hôte, noise texture, glassmorphism sur les cards, boutons avec glow au hover
- **Reconnexion joueur** : grace period 90s, restauration de l'état complet (score, éléments trouvés, choix QCM) au retour
- **Grace period hôte** portée à 2 minutes (était 60s)
- **Erreurs mid-game** : auto-dismiss après 6s pour éviter les fausses alertes persistantes
- Architecture : `checkEveryoneDone` ignore les joueurs déconnectés, `salon_join_player` gère le chemin de reconnexion

### v1.2.0 — Mode Salon

- **Mode Salon** (Kahoot-like) : expérience soirée avec un écran hôte sur TV/ordi et les joueurs sur leur téléphone
- Rejoindre via **QR code** (plein écran en lobby) ou code à 6 caractères, sans inscription requise
- Écran hôte : player YouTube visible en grand, barre timer, liste joueurs avec indicateurs en temps réel (🎤🎸🎵)
- Interface joueur mobile optimisée : texte libre ou **QCM 4 choix** (style Kahoot)
- Système de points identique au mode normal : artiste, titre, featurings scorés séparément avec bonus de vitesse
- Avance automatique entre les manches ou mode manuel
- Classement en temps réel, fin de partie avec rejouer / nouveau salon
- Code découpé en composants réutilisables (`HostCenter`, `PlayerSidebar`, `JoinForm`, `RoundPlay`, `SummaryView`, `FeedbackOverlay`)
- 100% éphémère — aucune sauvegarde en base, parties privées

### v1.1.0 — Profils publics & confidentialité

- **Profil public** : nouvelle page `/user/[username]` pour voir le profil de n'importe quel joueur
- **Auth obligatoire** : un compte est requis pour consulter un profil
- **Mode privé** : nouveau paramètre de confidentialité dans les Settings (Public / Privé)
- **Noms cliquables** : tous les pseudos dans l'appli (classements, scoreboard, fin de partie) sont désormais des liens vers le profil
- Les joueurs invités ne sont pas liés (pas de profil persistant)

### v1.0.0 — Sortie initiale

- Auth email + Google OAuth
- Rooms officielles et personnalisées (éphémères + persistantes)
- Gameplay multijoueur temps réel (Socket.IO)
- Import Spotify / Deezer
- Featurings multiples
- Classements ELO + hebdomadaire
- Profil avec stats et meilleurs scores
- Mode invité
- Responsive mobile + bouton de validation

---

## 📈 Roadmap

### ✅ v1.0 — Stable

- [x] Auth email + Google OAuth
- [x] Rooms officielles et personnalisées
- [x] Gameplay temps réel (Socket.IO)
- [x] Import Spotify / Deezer
- [x] Featurings multiples
- [x] Classements ELO + hebdomadaire
- [x] Profil avec stats et meilleurs scores
- [x] Mode invité
- [x] Rooms éphémères et persistantes
- [x] Responsive mobile + bouton de validation

### ✅ v1.1 — Profils publics

- [x] Page profil public `/user/[username]`
- [x] Connexion obligatoire pour voir un profil
- [x] Paramètre de confidentialité Privé / Public
- [x] Noms de joueurs cliquables partout dans l'appli

### ✅ v1.2 — Mode Salon

- [x] Mode Salon Kahoot-like (hôte TV + joueurs téléphone)
- [x] Rejoindre via QR code plein écran ou code à 6 caractères
- [x] Texte libre et QCM 4 choix (▲◆●■ style Kahoot)
- [x] Indicateurs de découverte en temps réel côté hôte (🎤🎸🎵)
- [x] Avance automatique ou manuelle
- [x] Reconnexion automatique en cours de partie (grace period 90s)
- [x] Redesign UI : timer SVG arc, glassmorphism, glow effects, visualizer 18 barres
- [x] Documentation en ligne complète (`/docs`)
- [x] Footer 4 colonnes professionnel

### ✅ v1.2.2 — Légal & SEO

- [x] Page Mentions Légales (`/mentions-legales`)
- [x] CGU et Politique de confidentialité enrichies (RGPD complet)
- [x] SEO avancé : JSON-LD WebSite/Organization/BreadcrumbList, Twitter Card, keywords
- [x] Sitemap étendu (`/rooms`, `/mentions-legales`)
- [x] Nettoyage répertoire `public/css/` mort

### ✅ v1.3.0 - Personalisation - Thèmes

- [x] Page paramètres modifiée (`/parametres`)
- [x] Ajout feuille de style globale (`/static/css/theme.css`)

### ✅ v1.4.0 — Contact, Signalements & Admin

- [x] Formulaire de contact (footer → modal)
- [x] Signalement joueur en jeu (menu ⋯ → formulaire motif + description)
- [x] Signalement bug en jeu (bouton 🐛 dans le header)
- [x] Table `reports` Supabase avec RLS (INSERT public, admin uniquement pour lecture/modif)
- [x] Notifications email via Edge Function Supabase `send-report` → Resend
- [x] Interface admin `/admin/reports` (protégée super_admin, filtres, actions)
- [x] Refonte complète de l'interface de jeu (layout 3 colonnes, glassmorphism, mobile)
- [x] SEO Bing / IndexNow (soumission automatique via GitHub Action)

---

## 🤝 Contribution

Le projet est ouvert aux suggestions et rapports de bugs via les **Issues GitHub**.

Un serveur Discord est prévu — lien à venir.

---

## 👨‍💻 Développeur

**Théo Foucher** — parce qu'il kiffe la **ZIK.**

> _"Développé avec SvelteKit, Supabase, et beaucoup trop de musique en fond."_
