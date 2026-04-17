# Design — Track Enricher + Bugs SIB

**Date :** 2026-04-17  
**Statut :** Approuvé

---

## Contexte

Retours terrain (entreprise SIB) : clavier mobile instable, son absent intermittent, Rooms inaccessibles aux non-connectés, artistes manquants (Jay-Z/Linkin Park), musiques hors époque.

---

## 1. Bug — Clavier mobile (focus input)

**Fichier :** `src/routes/(site)/game/+page.svelte`

**Problème :** `submitGuess()` et le handler `round_start_sync` utilisent `setTimeout(..., 50)` pour refocaliser `#guessInput`. Le délai de 50ms crée un gap où certains claviers Android détectent une perte de focus et ferment/rouvrent le clavier.

**Fix :** Remplacer les deux `setTimeout(() => el.focus(), 50)` par `tick().then(() => el.focus())`.

Lignes concernées :
- `submitGuess()` : ligne 203
- Handler `round_start_sync` : ligne 302

---

## 2. Bug — Son absent sur 2ème musique (intermittent)

**Fichier :** `src/routes/(site)/game/+page.svelte`

**Problème :** Race condition possible où `round_start_sync` arrive avant que YouTube n'atteigne l'état PLAYING. Le `ytPlayer.playVideo()` déclenché par le sync peut ne pas produire de nouvel événement PLAYING, laissant la vidéo muted.

**Fix :** Dans le handler `round_start_sync`, appeler `ytPlayer.unMute()` et `ytPlayer.setVolume(savedVol())` explicitement avant `ytPlayer.playVideo()`, sans attendre l'événement PLAYING.

---

## 3. Rooms — Accès lecture pour non-connectés

**Fichier :** `src/routes/(site)/rooms/+page.svelte`

**Problème :** Le bloc `{:else if !user}` (ligne 250) affiche un auth-wall qui bloque la totalité du contenu pour les visiteurs non connectés.

**Fix :** Supprimer le `{:else if !user}` auth-wall. Le contenu rooms est visible directement. Masquer conditionnellement avec `{#if user}` :
- Le bouton "+ Créer une room"
- L'onglet "Mes rooms"

L'onglet "Rooms publiques" reste visible et fonctionnel sans connexion. `loadPublicRooms()` n'a pas besoin de token (déjà géré).

---

## 4. Pipeline d'enrichissement de tracks

### 4.1 Fichier principal

**Nouveau fichier :** `src/lib/server/services/trackEnricher.js`

Pipeline en 4 étapes :

```
enrichTrack(rawTrack) → EnrichedTrack
  1. stringParse()       → title, mainArtist, feats[]  (base)
  2. musicBrainzLookup() → title?, mainArtist?, feats[]?, year?
  3. deezerSearch()      → coverUrl?, previewUrl?
  4. merge()             → champs finaux avec scoring de confiance
```

#### Étape 1 — String parsing

Strips appliqués au **titre** (regex, case-insensitive) :
- `(Remaster ...)` / `(Remastered ...)` / `- XXXX Remaster`
- `[Live ...]` / `(Live ...)`
- `(Radio Edit)` / `(Single Edit)` / `(Album Version)`
- `(Acoustic ...)` / `(Instrumental)` / `(Extended ...)` / `(Demo)` / `(Karaoke)`
- `(Official Video)` / `(Official Audio)` / `(Official Music Video)`
- `(Original Mix)` / `(Club Mix)` / `(Deluxe ...)`
- Années seules : `(2021)`, `[1999]`

Extraction feat depuis le **titre** : `Title (feat. X & Y)` → `title="Title"`, `feats=["X","Y"]`

Extraction feat depuis le **champ artiste** : via `parseFeaturing()` existant dans `playlist.js`.

Merge des feats des deux sources, déduplication.

**Préservé** : noms de groupes légitimes (`Earth, Wind & Fire`), duos (`Bigflo & Oli`), titres sans patterns reconnus.

#### Étape 2 — MusicBrainz

```
GET https://musicbrainz.org/ws/2/recording/
  ?query=artist:{mainArtist}+recording:{cleanTitle}&limit=5&fmt=json
  User-Agent: ZIK-BlindTest/1.0 (zik-music.fr)
```

- Sélectionner le résultat avec score ≥ 85
- Extraire : titre canonique, tous les `artist-credit` (main + feats), `first-release-date` (année)
- Rate limit : délai de **1100ms** entre chaque requête (obligation MusicBrainz)
- Fallback silencieux si score < 85 ou erreur réseau

#### Étape 3 — Deezer search

```
GET https://api.deezer.com/search?q=artist:"{main}" track:"{title}"&limit=3
```

- Récupère `cover_url` (album cover HD), `preview_url` si absent en BDD
- Ne pas utiliser pour les crédits artistes (MusicBrainz est plus fiable)
- Utilise le service `deezer.js` existant via `getFetch()`

#### Étape 4 — Scoring et merge

| Champ | Source prioritaire | Fallback |
|---|---|---|
| `custom_title` | MusicBrainz (score ≥ 85) | string parse |
| `custom_artist` | MusicBrainz artist-credit[0] | string parse |
| `custom_feats` | MusicBrainz artist-credit[1+] | string parse (merged) |
| `cover_url` | Deezer (si absente ou par défaut) | existant en BDD |
| `preview_url` | existant en BDD | Deezer search |

**Les colonnes `artist` et `title` brutes ne sont jamais modifiées** (traçabilité).  
`buildTrack()` dans `playlist.js` utilise déjà `custom_*` en priorité — aucune modification du runtime.

### 4.2 Endpoints SSE

#### User — `src/routes/(site)/api/playlists/[id]/enrich/+server.js`

```
POST /api/playlists/{playlistId}/enrich
Authorization: Bearer {token}
```

- Vérifie que l'utilisateur est propriétaire de la playlist
- Charge tous les tracks de `custom_playlist_tracks`
- Pour chaque track : enrichit, écrit en BDD, stream un event SSE
- Réponse : `ReadableStream` (Content-Type: `text/event-stream`)

Format des events SSE :
```
data: {"current":5,"total":50,"track":"Jay-Z — Numb/Encore","status":"enriched","changes":["feat: Linkin Park ajouté"]}\n\n
data: {"current":6,"total":50,"track":"Queen — Bohemian Rhapsody","status":"cleaned","changes":["titre: suppression '(2011 Remaster)'"]}\n\n
data: {"current":50,"total":50,"status":"done"}\n\n
```

Statuts possibles : `enriched` (MusicBrainz OK), `cleaned` (string parse only), `unchanged`, `error`

#### Admin — `src/routes/(admin)/api/enrich-playlist/+server.js`

```
POST /api/admin/enrich-playlist
Body: { playlistId }
```

- Même pipeline, sans vérification de propriété (admin = accès total)
- Même format SSE

### 4.3 UI — Modale de progression (playlists.svelte)

Dans `editor-header-actions`, nouveau bouton **"✨ Auto-enrichir"** à côté de "Lancer une room".

Au clic :
1. Ouvre une modale de progression (overlay au-dessus de l'éditeur)
2. Démarre `fetch('/api/playlists/{id}/enrich', { method: 'POST' })` et lit le stream
3. Affiche une barre de progression + log scrollable en temps réel :
   ```
   ✅ Jay-Z — Numb/Encore  (feat. Linkin Park ajouté)
   ✅ Queen — Bohemian Rhapsody  (titre nettoyé)
   ⚠️  Benson Boone — Beautiful Things  (string parse uniquement)
   ```
4. Bouton "Fermer" actif uniquement quand `status: "done"` reçu
5. Recharge les tracks à la fermeture

**Admin** : même bouton dans `admin/playlists/[id]/+page.svelte`, appelle l'endpoint admin.

---

## 5. Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `src/routes/(site)/game/+page.svelte` | Fix tick() focus + unMute() sécurité |
| `src/routes/(site)/rooms/+page.svelte` | Retrait auth-wall non-connectés |
| `src/lib/server/services/trackEnricher.js` | **Nouveau** — pipeline complet |
| `src/routes/(site)/api/playlists/[id]/enrich/+server.js` | **Nouveau** — endpoint SSE user |
| `src/routes/(admin)/api/enrich-playlist/+server.js` | **Nouveau** — endpoint SSE admin |
| `src/routes/(site)/playlists/+page.svelte` | Bouton + modale progression |
| `src/routes/(admin)/admin/playlists/[id]/+page.svelte` | Bouton enrichissement admin |

**Aucune migration BDD** — colonnes `custom_artist`, `custom_title`, `custom_feats` déjà présentes.

---

## 6. Contraintes

- MusicBrainz : 1 req/sec max → délai 1100ms entre tracks
- Pas de modification des colonnes `artist`/`title` brutes
- L'enrichissement est non-destructif : si MusicBrainz ne trouve rien, on garde le string parse
- La connexion SSE reste ouverte le temps du traitement (pas de timeout client)
- L'enrichissement ne touche pas au runtime de jeu (`game.js`, `checkMatch`, `cleanString`)
