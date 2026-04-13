# ZIK Admin — Phase 2 : Design Spec

**Date :** 2026-04-13  
**Statut :** ✅ Approuvé  
**Scope :** Gestion Rooms + Gestion Playlists (+ tracks)  
**Phase précédente :** Phase 1 (Sécurité + Dashboard + Users)  
**Phase suivante :** Phase 3 (Live control + Annonces)

---

## Contexte

Phase 1 a livré : sécurité server-side (`requireAdmin()`), dashboard darknet (stats + SSE live), gestion complète des users.

Phase 2 ajoute la gestion des Rooms et des Playlists (avec leurs tracks) depuis l'espace admin. Toutes les tables cibles existent déjà (`rooms`, `custom_playlists`, `custom_playlist_tracks`). Aucune migration BDD nécessaire.

**Approche retenue :** Rooms = tableau + actions inline (modals). Playlists = tableau inline + fiche détail `/admin/playlists/[id]` pour la gestion des tracks.

---

## Section 1 — Gestion Rooms (`/admin/rooms`)

### Liste

- Tableau paginé 50 rooms/page, chargé server-side via `getAdminClient()`
- Colonnes : code, name, emoji, owner (username via JOIN profiles), `is_public`, `is_official`, max_rounds, last_active_at
- Recherche par name ou code (query param `?q=`, ILIKE)
- Tri : `last_active_at` desc (défaut), `created_at`, `name`

### Actions inline

| Action | UI | Confirmation |
|---|---|---|
| Toggle `is_official` | clic direct | non |
| Toggle `is_public` | clic direct | non |
| Modifier name, emoji, description, max_rounds, round_duration, break_duration, auto_start | modal | non |
| Supprimer la room | bouton | oui |

### Audit log

Chaque mutation insère dans `admin_audit_log` :
- `toggle_room_flag` — payload : `{ field, old, new }`
- `edit_room` — payload : diff des champs modifiés
- `delete_room` — payload : `{ code, name }`

---

## Section 2 — Gestion Playlists (`/admin/playlists` + `/admin/playlists/[id]`)

### Liste (`/admin/playlists`)

- Tableau paginé 50 playlists/page, server-side
- Colonnes : name, emoji, owner (username via JOIN profiles), `is_public`, `is_official`, track_count, created_at
- Recherche par name (`?q=`, ILIKE)
- Tri : `track_count` desc (défaut), `created_at`, `name`

### Actions inline

| Action | UI | Confirmation |
|---|---|---|
| Toggle `is_official` | clic direct | non |
| Toggle `is_public` | clic direct | non |
| Modifier name, emoji | modal | non |
| Supprimer la playlist | bouton | oui |

### Fiche détail (`/admin/playlists/[id]`)

Chargée server-side via `getAdminClient()` :

- Header : name, emoji, owner username, track_count, created_at, updated_at
- Tableau des tracks : position, artist, title, source, preview_url (lien externe), created_at
- Actions par track : supprimer (confirmation non)
- Réordonnement : boutons ▲▼ par ligne → `UPDATE custom_playlist_tracks SET position = $1`
- Bouton "Supprimer la playlist" en bas de page (confirmation oui)

### Audit log

- `toggle_playlist_flag` — payload : `{ field, old, new }`
- `edit_playlist` — payload : diff des champs modifiés
- `delete_playlist` — payload : `{ name, track_count }`
- `delete_track` — payload : `{ playlist_id, artist, title }`
- `reorder_tracks` — payload : `{ playlist_id, moved_track_id, old_position, new_position }`

---

## Section 3 — Nav + Routes

### Nav (`+layout.svelte`)

Ajouter 2 liens :
```
⬡ Dashboard  ◈ Users  ◉ Reports  ◧ Rooms  ◫ Playlists
```

### Nouvelles routes

```
src/routes/(admin)/admin/
  rooms/
    +page.svelte         ← tableau + modals inline
    +page.server.js      ← load (liste) + actions (toggle, edit, delete)
  playlists/
    +page.svelte         ← tableau + modals inline
    +page.server.js      ← load (liste) + actions (toggle, edit, delete)
    [id]/
      +page.svelte       ← fiche détail + tracks
      +page.server.js    ← load (playlist + tracks) + actions (delete_track, reorder, delete_playlist)
```

### Fichiers modifiés

```
src/routes/(admin)/+layout.svelte   ← ajouter liens Rooms + Playlists dans la nav
```

---

## Sécurité

Toutes les actions SvelteKit appellent `requireAdmin(request)` (déjà implémenté en phase 1) — valide le JWT depuis le champ `_token` du formData.

---

## Ce qui est hors scope Phase 2

- Ajouter des tracks depuis l'admin → hors scope (juste voir/supprimer/réordonner)
- Changer la playlist liée d'une room → hors scope (inutile)
- Contrôle live des parties → Phase 3
- Gestion des Annonces → Phase 3
