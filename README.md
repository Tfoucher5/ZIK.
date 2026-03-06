# 🎵 BT Project v0.2 — Blind Test Multijoueur

## Stack
- **Backend** : Node.js + Express + Socket.IO
- **Base de données** : Supabase (PostgreSQL)
- **Auth** : Supabase Auth (email/password)
- **Musique** : Deezer API (playlists) + YouTube IFrame (lecture) 

---

## 🚀 Installation

### 1. Créer le projet Supabase
1. Va sur [supabase.com](https://supabase.com) → New project
2. Dashboard → **SQL Editor** → colle le contenu de `supabase_schema.sql` → Run
3. Dashboard → **Settings → API** → copie `Project URL` et `anon public key`

### 2. Configurer l'auth Supabase
1. Dashboard → **Authentication → Providers** → Email → Active
2. (Optionnel) Désactive "Confirm email" pour les tests

### 3. Lancer le projet
```bash
cp .env.example .env
# Édite .env avec tes clés Supabase

npm install
npm run dev   # développement
npm start     # production
```

→ **http://localhost:3000**

### 4. Configurer les clés côté client
Dans `public/home.js`, remplace :
```js
const SUPABASE_URL = 'REMPLACE_PAR_TON_URL_SUPABASE';
const SUPABASE_ANON_KEY = 'REMPLACE_PAR_TA_CLE_ANON_SUPABASE';
```

---

## 🌍 Déployer sur Railway

1. Push sur GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Variables d'environnement dans Railway :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` = `3000` (ou laisser Railway gérer)
4. Ton URL sera auto-générée (ex: `bt-project.up.railway.app`)

> Le `PORT` est injecté automatiquement par Railway via `process.env.PORT`.

---

## 🎮 Rooms disponibles
| Room | Playlist Deezer |
|------|----------------|
| 🎤 Hip-Hop / Rap FR | 1963962142 |
| 🎧 Électro / Dance | 1313621735 |
| 🌍 Pop Internationale | 3155776842 |
| 📼 Années 80/90/2000 | 1109278281 |
| 🤘 Rock / Metal | 1313621375 |
| 🎬 Films & Séries | 1279192301 |

> Pour changer une playlist, modifie `rooms.js` → `playlist_id`

---

## 📁 Structure
```
bt-project/
├── server.js          # Serveur principal (Express + Socket.IO + Supabase)
├── rooms.js           # Config des rooms
├── supabase_schema.sql # Schéma SQL à coller dans Supabase
├── .env.example       # Variables d'env à configurer
├── package.json
└── public/
    ├── index.html     # Page d'accueil (rooms + leaderboards)
    ├── home.css
    ├── home.js        # Auth Supabase + affichage rooms
    ├── game.html      # Page de jeu
    ├── game.css
    └── game.js        # Logique client Socket.IO + YouTube
```

---

## Roadmap
- [ ] Rooms custom (import lien playlist Deezer/Spotify)
- [ ] Page profil joueur (stats, historique, rang)
- [ ] Classement ELO visible sur home
- [ ] Mode solo (pratique)
- [ ] Mobile responsive complet
