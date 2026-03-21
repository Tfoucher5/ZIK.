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

- Design **dark mode** natif
- **Responsive mobile** — layout optimisé touch avec bouton de validation
- Rooms publiques browsables + rejoindre par code
- Navigation fluide avec animations
- Noms de joueurs **cliquables** partout (classements, scoreboard en jeu, écran de fin)

---

## 🛠️ Stack Technique

| Couche               | Techno                                   |
| -------------------- | ---------------------------------------- |
| **Framework**        | SvelteKit 2 (Svelte 5)                   |
| **Serveur**          | Node.js + SvelteKit adapter-node         |
| **Temps réel**       | Socket.IO                                |
| **Base de données**  | Supabase (PostgreSQL + RLS)              |
| **Auth**             | Supabase Auth (email + Google OAuth)     |
| **Musique**          | YouTube IFrame API (lecture)             |
| **Import playlists** | Spotify Web API + Deezer API             |
| **Style**            | CSS vanilla (variables, dark mode natif) |
| **Déploiement**      | Vercel (frontend) + serveur Node dédié   |

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
│       ├── salon/             # Mode Salon (setup + hôte + joueur)
│       │   ├── host/          # Écran hôte (TV/ordi)
│       │   └── play/          # Interface joueur (téléphone)
│       ├── profile/           # Mon profil (édition)
│       ├── user/[username]/   # Profil public d'un joueur
│       ├── settings/          # Paramètres (visuel, jeu, confidentialité)
│       ├── rooms/             # Browsing des rooms
│       ├── playlists/         # Gestion des playlists
│       └── api/               # Endpoints REST
├── static/css/                # Styles par page
└── supabase_schema.sql        # Schéma complet de la base de données
```

---

## 📋 Changelog

### v1.2.0 — Mode Salon

- **Mode Salon** (Kahoot-like) : expérience soirée avec un écran hôte sur TV/ordi et les joueurs sur leur téléphone
- Rejoindre via **QR code** (plein écran en lobby) ou code à 6 caractères, sans inscription requise
- Écran hôte : player YouTube visible en grand, barre timer, liste joueurs avec indicateurs en temps réel (🎤🎸🎵)
- Interface joueur mobile optimisée : texte libre ou **QCM 4 choix** (style Kahoot)
- Système de points identique au mode normal : artiste, titre, featurings scorés séparément avec bonus de vitesse
- Avance automatique entre les manches ou mode manuel
- Classement en temps réel, fin de partie avec rejouer / nouveau salon
- **Reconnexion automatique** : un joueur qui se déconnecte en cours de partie (coupure réseau, veille mobile) retrouve son score et son état au retour, avec une grace period de 90 secondes
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
- [x] Texte libre et QCM 4 choix
- [x] Indicateurs de découverte en temps réel côté hôte (🎤🎸🎵)
- [x] Avance automatique ou manuelle
- [x] Reconnexion automatique en cours de partie (grace period 90s)

### 🚧 v1.3 — En réflexion

- [ ] Répondre avec la voix (mobile uniquement)
- [ ] Formulaire de contact

---

## 🤝 Contribution

Le projet est ouvert aux suggestions et rapports de bugs via les **Issues GitHub**.

Un serveur Discord est prévu — lien à venir.

---

## 👨‍💻 Développeur

**Théo Foucher** — parce qu'il kiffe la **ZIK.**

> _"Développé avec SvelteKit, Supabase, et beaucoup trop de musique en fond."_
