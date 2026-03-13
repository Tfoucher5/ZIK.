# ZIK. 🎵

> Blind test multijoueur en temps réel — trouve les titres avant tout le monde.

---

## 📑 Sommaire

- [Présentation](#-présentation)
- [Fonctionnalités](#-fonctionnalités)
- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
- [Installation](#-installation)
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

| Couche | Techno |
|---|---|
| **Framework** | SvelteKit 2 (Svelte 5) |
| **Serveur** | Node.js + SvelteKit adapter-node |
| **Temps réel** | Socket.IO |
| **Base de données** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (email + Google OAuth) |
| **Musique** | YouTube IFrame API (lecture) |
| **Import playlists** | Spotify Web API + Deezer API |
| **Style** | CSS vanilla (variables, dark mode natif) |
| **Déploiement** | Vercel (frontend) + serveur Node dédié |

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

## 🚀 Installation

### Prérequis
- Node.js >= 18
- Compte [Supabase](https://supabase.com)
- Credentials Spotify API (pour l'import de playlists)

### Setup

```bash
# 1. Cloner le repo
git clone https://github.com/Tfoucher5/ZIK
cd ZIK

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Remplir SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, ADMIN_USER_ID

# 4. Appliquer le schéma Supabase
# Importer supabase_schema.sql dans ton projet Supabase
# Si la table profiles existe déjà, jouer la migration :
# ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

# 5. Lancer le serveur
node server.js
# ou en développement :
npm run dev
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL de ton projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (opérations serveur) |
| `SPOTIFY_CLIENT_ID` | Client ID de ton app Spotify |
| `SPOTIFY_CLIENT_SECRET` | Secret de ton app Spotify |
| `ADMIN_USER_ID` | UUID Supabase de l'admin (accès super_admin) |

---

## 📋 Changelog

### v1.1.0 — Profils publics & confidentialité
- **Profil public** : nouvelle page `/user/[username]` pour voir le profil de n'importe quel joueur
- **Auth obligatoire** : un compte est requis pour consulter un profil
- **Mode privé** : nouveau paramètre de confidentialité dans les Settings (Public / Privé)
- **Noms cliquables** : tous les pseudos dans l'appli (classements, scoreboard, fin de partie) sont désormais des liens vers le profil
- Les joueurs invités ne sont pas liés (pas de profil persistant)
- Ajout du champ `is_private` dans la table `profiles`

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

### 🚧 v1.2 — En réflexion
- [ ] Notifications en jeu (son, vibration mobile)
- [ ] Statistiques détaillées par room
- [ ] Mode spectateur

### 🔮 Idées futures
- [ ] Application mobile native (PWA)
- [ ] Tournois et brackets
- [ ] Mode solo (entraînement)
- [ ] Intégration Apple Music

---

## 🤝 Contribution

Le projet est ouvert aux suggestions et rapports de bugs via les **Issues GitHub**.

Un serveur Discord est prévu — lien à venir.

---

## 👨‍💻 Développeur

**Théo Foucher** — parce qu'il kiffe la **ZIK.**

> *"Développé avec SvelteKit, Supabase, et beaucoup trop de musique en fond."*
