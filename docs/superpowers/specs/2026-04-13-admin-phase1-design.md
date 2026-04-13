# ZIK Admin — Phase 1 : Design Spec

**Date :** 2026-04-13  
**Statut :** ✅ Approuvé  
**Scope :** Sécurité + Dashboard + Gestion Users  
**Phases suivantes :** Phase 2 (Rooms + Playlists), Phase 3 (Live control + Annonces)

---

## Contexte

L'espace admin existant (`/admin`) contient une seule page : `/admin/reports`.  
Le guard est client-side uniquement (`onMount` dans `+layout.svelte` → check `role = 'super_admin'` dans `profiles`).  
Les `actions` SvelteKit des pages admin ne vérifient aucun rôle côté serveur — faille à corriger.

**Stack :** SvelteKit 5 (Svelte 5 runes), Supabase (service key via `getAdminClient()`), Socket.io, Railway.  
**Approche retenue :** Approche A — routes SvelteKit dédiées, server-side avec `getAdminClient()`, SSE pour le live.

---

## Section 1 — Sécurité

### Problème actuel

- Guard 100% client-side → contournable si JS désactivé
- Aucune vérification de rôle sur les `actions` SvelteKit (POST directs possibles)
- Pas de traçabilité des actions admin

### Ajouts

**1. Helper `requireAdmin(request)` dans `src/lib/server/middleware/auth.js`**

- Extrait le JWT du header `Authorization: Bearer <token>`
- Appelle `verifyToken()` existant (déjà dans auth.js)
- Vérifie `role = 'super_admin'` dans `profiles` via service key
- Throw `error(403, 'Accès refusé')` si non autorisé

**2. Validation server-side sur toutes les `actions` admin**

- Chaque action admin envoie le JWT en hidden field `_token`
- Le serveur appelle `requireAdmin()` avant toute mutation

**3. Endpoint SSE `/api/admin/live`**

- Valide le token via query param `?token=xxx` à la connexion
- Lecture seule du state mémoire (`globalThis.__zik_roomGames`, `__zik_salonRooms`)

**4. Table `admin_audit_log` (nouvelle)**

```sql
CREATE TABLE admin_audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,       -- 'ban_user', 'edit_stats', 'delete_user', etc.
  target_id   uuid,                -- id du user/room/playlist ciblé
  target_type text,                -- 'user', 'room', 'playlist'
  payload     jsonb DEFAULT '{}',  -- détail de ce qui a changé
  created_at  timestamptz DEFAULT now()
);
-- Pas de RLS UPDATE/DELETE : immuable
```

**Règle :** toute mutation admin insère une ligne dans `admin_audit_log`.

---

## Section 2 — Dashboard (`/admin/dashboard`)

### Style

- Fond `#0a0a0f`, texte vert phosphore `#00ff41` / ambre `#ffb300`
- Police monospace (Inter Mono ou system-ui mono)
- Effet scan-lines CSS subtil (pseudo-element sur le fond)
- Vibe "terminal cartel" — pas de couleurs pastel, tout est data brute

### Bloc Stats (server-side au load)

6 cartes chargées via `getAdminClient()` :

| Métrique                   | Source                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Total users inscrits       | `COUNT(profiles)`                                                 |
| Users actifs 7j            | `COUNT(game_players)` jointure `games` où `started_at > now()-7j` |
| Parties jouées aujourd'hui | `COUNT(games)` où `started_at > today`                            |
| Rooms publiques            | `COUNT(rooms)` où `is_public = true`                              |
| Reports en attente         | `COUNT(reports)` où `status = 'pending'`                          |
| Uptime serveur             | `process.uptime()` formaté HH:MM:SS                               |

### Bloc Live (SSE)

Endpoint `GET /api/admin/live?token=xxx` — push toutes les **2 secondes** :

```json
{
  "roomGames": [
    { "roomId": "JAZZ", "players": 4, "round": 3, "maxRounds": 10 }
  ],
  "salonRooms": [
    { "code": "ABC123", "host": "Theo", "players": 3, "state": "playing" }
  ],
  "totalConnected": 7,
  "ts": 1713000000000
}
```

- Indicateur de connexion : point vert pulsant = connecté, rouge = reconnexion
- Reconnexion auto avec backoff exponentiel (1s → 2s → 4s → max 30s)
- Aucune interaction avec Socket.io — lecture seule du globalThis

---

## Section 3 — Gestion Users (`/admin/users`)

### Liste (`/admin/users`)

- Tableau paginé 50 users/page, chargé server-side
- Colonnes : avatar, username, rôle, ELO, level, games joués, date inscription, statut banni
- Recherche par username (query param `?q=`, ILIKE)
- Tri par : ELO (défaut desc), level, games_played, created_at
- Badge coloré pour les `super_admin`

### Fiche user (`/admin/users/[id]`)

Chargée server-side via `getAdminClient()` :

- Profil complet (avatar, username, stats)
- 20 dernières parties (`game_players` JOIN `games`)
- Reports le concernant (reporter ou reporté)
- Toutes les actions ci-dessous

### Actions disponibles

| Action                        | Implémentation                                                                 | Confirmé ?                                    |
| ----------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| **Ban**                       | `supabase.auth.admin.updateUserById(id, { ban_duration: 'none' \| '87600h' })` | Oui                                           |
| **Unban**                     | Même API, `ban_duration: 'none'`                                               | Non                                           |
| **Modifier username**         | `UPDATE profiles SET username = $1`                                            | Oui (taper le nouveau)                        |
| **Modifier XP / ELO / level** | `UPDATE profiles SET xp=$1, elo=$2, level=$3`                                  | Oui                                           |
| **Reset stats**               | `UPDATE profiles SET xp=0, elo=1000, level=1, games_played=0, total_score=0`   | Oui (confirmation)                            |
| **Changer rôle**              | `UPDATE profiles SET role=$1`                                                  | Oui                                           |
| **Supprimer compte**          | `supabase.auth.admin.deleteUser(id)`                                           | Double confirmation : taper le username exact |

**Toutes les actions** → insert dans `admin_audit_log` avant/après.

### Confirmation double pour suppressions

Modale avec champ texte : "Tape le username pour confirmer la suppression définitive".  
Vérification côté serveur également.

---

## Nouvelles routes à créer

```
src/routes/(admin)/admin/
  dashboard/
    +page.svelte
    +page.server.js
  users/
    +page.svelte
    +page.server.js
    [id]/
      +page.svelte
      +page.server.js

src/routes/(site)/api/admin/
  live/
    +server.js          ← SSE endpoint
```

## Nouveaux fichiers à modifier

```
src/routes/(admin)/+layout.svelte        ← ajouter liens nav (Dashboard, Users) + exposer le JWT via setContext
src/routes/(admin)/admin/+page.server.js ← changer redirect vers /admin/dashboard
src/lib/server/middleware/auth.js        ← ajouter requireAdmin()
```

### Passage du JWT aux pages admin

Le layout admin crée son propre client Supabase dans `onMount` et récupère la session.  
Le JWT (`session.access_token`) est exposé via `setContext('adminToken', token)` pour que les pages puissent l'injecter dans les hidden fields `_token` des form actions.

## Migration BDD (Supabase)

```sql
-- Table audit log (immuable)
CREATE TABLE admin_audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,
  target_id   uuid,
  target_type text,
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- RLS : seul le service key peut insérer/lire
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service key only" ON admin_audit_log USING (false);
```

---

## Ce qui est hors scope Phase 1

- Gestion des Rooms → Phase 2
- Gestion des Playlists → Phase 2
- Contrôle live des parties (kick, stop forcé) → Phase 3
- Gestion des Annonces → Phase 3
- Impersonation → abandonnée (ratio complexité/utilité trop faible pour ZIK)

---

## Avancement

- [x] Brainstorming & questions de clarification
- [x] Choix d'approche (Approche A)
- [x] Design approuvé (4 sections)
- [ ] Plan d'implémentation
- [ ] Implémentation
