# Spec : Streaks, Achievements & Carte de Score Partageable

**Date :** 2026-04-14  
**Statut :** Approuvé

---

## Périmètre

1. **Streaks** — jours consécutifs joués + victoires consécutives
2. **Achievements** — système one-time et progressif (bronze/argent/or), rareté, mis en avant sur profil
3. **Notification de déblocage** — toast stylé en haut, non bloquant
4. **Carte de score partageable** — lien + export image en fin de partie
5. **Fix rejouer** — décompte de 10s avant relance au lieu d'un redémarrage immédiat

---

## 1. Base de données

### Nouvelles colonnes dans `profiles`

```sql
current_streak      int   DEFAULT 0     -- jours consécutifs joués
best_streak         int   DEFAULT 0     -- record streak journalière
last_played_date    date  DEFAULT NULL  -- pour calcul streak
win_streak          int   DEFAULT 0     -- victoires consécutives en cours
best_win_streak     int   DEFAULT 0     -- record win streak
featured_achievements text[] DEFAULT '{}'  -- max 5 achievement_id épinglés
```

### Nouvelle table `achievements` (définitions statiques, gérées par admin)

```sql
CREATE TABLE achievements (
  id          text PRIMARY KEY,           -- ex: 'first_win'
  name        text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL,              -- emoji
  type        text NOT NULL,              -- 'one_time' | 'tiered'
  tiers       jsonb DEFAULT NULL,         -- [{level:'bronze',target:1}, ...]
  rarity      text NOT NULL,              -- 'common' | 'rare' | 'epic' | 'legendary'
  category    text NOT NULL               -- 'streak' | 'wins' | 'score' | 'social'
);
```

### Nouvelle table `user_achievements`

```sql
CREATE TABLE user_achievements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES achievements(id),
  tier           text DEFAULT NULL,       -- 'bronze' | 'silver' | 'gold' | null si one_time
  unlocked_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, achievement_id, tier)
);
```

RLS :

- SELECT : `user_id = auth.uid()` OU profil public
- INSERT/UPDATE : bloqué côté client — les insertions se font exclusivement depuis `game.js` via le client Supabase service role (qui bypass RLS)

### Nouvelle table `game_results` (pour les liens partageables)

```sql
CREATE TABLE game_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid NOT NULL REFERENCES games(id),
  user_id     uuid NOT NULL REFERENCES profiles(id),
  score       int NOT NULL,
  rank        int NOT NULL,
  total_players int NOT NULL,
  room_name   text NOT NULL,
  room_emoji  text NOT NULL,
  achievement_ids text[] DEFAULT '{}',   -- achievements débloqués pendant cette partie
  created_at  timestamptz DEFAULT now()
);
```

RLS : SELECT public (lien partageable accessible sans auth).

---

## 2. Achievements définis (données initiales)

| ID              | Nom               | Type     | Tiers (target)        | Rareté              | Catégorie |
| --------------- | ----------------- | -------- | --------------------- | ------------------- | --------- |
| `first_win`     | Première victoire | one_time | —                     | common              | wins      |
| `wins_count`    | Gagnant           | tiered   | B:5 / S:25 / G:100    | common→rare→epic    | wins      |
| `podium_count`  | Sur le podium     | tiered   | B:10 / S:50 / G:200   | common→rare→epic    | wins      |
| `streak_days`   | Assidu            | tiered   | B:3j / S:7j / G:30j   | rare→epic→legendary | streak    |
| `win_streak`    | En feu            | tiered   | B:3 / S:5 / G:10      | rare→epic→legendary | streak    |
| `score_1000`    | Mille points      | one_time | —                     | common              | score     |
| `perfect_game`  | Sans faute        | one_time | —                     | rare                | score     |
| `score_total`   | Collectionneur    | tiered   | B:10k / S:100k / G:1M | common→rare→epic    | score     |
| `games_played`  | Vétéran           | tiered   | B:10 / S:50 / G:200   | common→rare→epic    | social    |
| `early_adopter` | Early Adopter     | one_time | —                     | legendary           | social    |

`perfect_game` = avoir répondu correctement à tous les rounds d'une partie (`correctAnswers === totalRounds`, minimum 5 rounds).  
`early_adopter` = débloqué manuellement par l'admin pour les premiers inscrits.

---

## 3. Logique serveur (`game.js`)

### Fonction `checkAchievements(userId, gameData)`

Appelée après `update_player_stats` pour chaque joueur authentifié non-guest.

`gameData` contient : `{ score, rank, totalPlayers, correctAnswers, totalRounds }`

**Étape 1 — Mise à jour streaks dans `profiles` :**

- Charger `last_played_date`, `current_streak`, `best_streak`, `win_streak`, `best_win_streak`
- Streak journalière :
  - Si `last_played_date` = hier → `current_streak + 1`
  - Si `last_played_date` = aujourd'hui → inchangé
  - Sinon → reset à 1
  - Mettre à jour `best_streak = MAX(best_streak, current_streak)`
- Win streak :
  - Si `rank === 1` → `win_streak + 1`
  - Sinon → reset à 0
  - Mettre à jour `best_win_streak = MAX(best_win_streak, win_streak)`
- Upsert `profiles` avec les nouvelles valeurs + `last_played_date = today`

**Étape 2 — Vérification achievements :**

- Charger le profil mis à jour + tous les `user_achievements` du joueur
- Pour chaque achievement de la liste :
  - Calculer la valeur courante (ex: `games_played`, `best_streak`, `win_streak`, `total_score`, etc.)
  - Pour `one_time` : si pas encore débloqué et condition remplie → insérer
  - Pour `tiered` : pour chaque tier non encore débloqué, si condition remplie → insérer
- Collecter tous les nouveaux déblocages

**Étape 3 — Stockage résultat partageable :**

- Insérer dans `game_results` : score, rank, totalPlayers, roomName, roomEmoji, achievement_ids débloqués cette partie

**Étape 4 — Émission Socket.io :**

```js
socket.emit("achievements_unlocked", newUnlocks);
// newUnlocks = [{ id, name, icon, tier, rarity }]
socket.emit("game_result_id", resultId);
// resultId = uuid de game_results pour construire le lien partageable
```

---

## 4. Fix "Rejouer"

**Comportement actuel :** clic sur "Rejouer" relance immédiatement pour tout le monde.

**Nouveau comportement :**

- Le premier joueur qui clique émet `request_restart`
- Le serveur émet `restart_countdown` à tous les joueurs dans la room
- Côté client : affichage d'un décompte de 10s sur la popup de fin de partie
- À 0 : le serveur relance la partie (comportement identique à aujourd'hui)
- Les joueurs qui n'ont pas fermé leur popup arrivent en cours de partie — comportement accepté

---

## 5. Frontend

### Composant `AchievementToast.svelte`

- Toast en haut de l'écran, z-index élevé, auto-dismiss 4s
- Contenu : icône + nom + tier (si applicable) + badge rareté coloré
- File d'attente si plusieurs déblocages simultanés (s'affichent l'un après l'autre)
- Écoute l'event Socket.io `achievements_unlocked`

### Page Profil (`/profile` + `/user/[username]`)

**Section streaks (en haut du profil) :**

```
🔥 X jours consécutifs  (record : Y)
⚡ X victoires d'affilée (record : Y)
```

**Section achievements (compacte) :**

- Badges épinglés : 3-5 slots, le joueur choisit lesquels afficher (drag ou sélection)
- Bouton "Voir tous les achievements (X débloqués / Y total)"
- Ouvre `AchievementsModal.svelte`

### Composant `AchievementsModal.svelte`

- Modale pleine largeur (mobile-friendly)
- Filtres par catégorie : Tous / Streaks / Victoires / Score / Social
- Grille : achievements débloqués (avec date + tier) en couleur, non débloqués en grisé/verrouillé
- Pour les tiered : afficher les 3 tiers avec progression visuelle
- Réutilisé sur `/profile` (éditable) et `/user/[username]` (lecture seule)

### Popup de fin de partie (modifications)

- Ajout d'un bouton "Partager mon score"
- Ouvre une carte de score (composant `ScoreCard.svelte`) avec :
  - Pseudo + avatar, score, rang, room (nom + emoji), date
  - Achievements débloqués pendant la partie (si applicable)
  - Branding ZIK + URL
- Bouton "Copier le lien" → `https://www.zik-music.fr/results/[gameResultId]`
- Bouton "Télécharger l'image" → `html-to-image` (screenshot de la `ScoreCard`)
- Décompte de 10s visible en bas de la popup si un joueur a cliqué "Rejouer"

### Route `/results/[id]`

- Page publique (pas de noindex, ou noindex à confirmer)
- Affiche la carte de score du joueur, lien vers ZIK
- Accessible sans être connecté

---

## 6. Gestion admin (hors scope immédiat)

- Interface future pour ajouter/modifier/désactiver des achievements dans la table `achievements`
- Déblocage manuel de `early_adopter` pour les premiers inscrits via SQL ou interface admin

---

## Dépendances techniques

- `html-to-image` (npm) — export image côté client
- Pas de nouvelle dépendance côté serveur

---

## Hors scope

- Notifications push (email, browser)
- Classement par achievements entre amis
- Récompenses en XP bonus lors du déblocage (peut être ajouté plus tard)
