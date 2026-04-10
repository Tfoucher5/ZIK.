# Spec — Refactor page profil ZIK

**Date :** 2026-04-11  
**Statut :** Validé  
**Branche cible :** `fix/admin-nav-salon-feedback` (ou nouvelle branche dédiée)

---

## Objectif

Remplacer la page profil actuelle (hero + 4 stat-cards + liste meilleurs scores) par une page riche en cartes avec toutes les stats disponibles, une courbe d'évolution, un historique de parties et une répartition par type de room.

S'applique aux deux routes :
- `/profile` — profil personnel (avec bouton "Modifier le profil")
- `/user/[username]` — profil public d'un autre joueur

---

## Layout général

Page en grille 12 colonnes (`gap: 14px`), `max-width: 980px`, centrée.

### Hero (hors grille)
- Avatar (88px, rond, bordure accent)
- Nom + badge rang classement ("Top X%") + ELO
- "Membre depuis [mois année]" (`profiles.created_at`)
- Barre XP : `profiles.xp` / seuil du niveau suivant (calculé côté client)
- Bouton "Modifier le profil" (visible uniquement sur `/profile`)

### Grille de cartes (8 cartes)

#### Rangée 1 — 4 colonnes × 3 chacune
| Carte | Données | Notes |
|---|---|---|
| **ELO** | `profiles.elo` | Delta mensuel calculé depuis l'historique |
| **Parties jouées** | `profiles.games_played` | Nb ce mois depuis historique |
| **Score total** | `profiles.total_score` | Score moyen = total / games_played affiché en sous-titre |
| **Win rate** | % rank=1 dans `game_players` | "X victoires / Y parties" + mini barre |

#### Rangée 2 — courbe (col-8) + répartition (col-4)
| Carte | Données | Notes |
|---|---|---|
| **Évolution du score** | 10 dernières parties : `game_players.score` + `games.ended_at` | Courbe SVG, points horodatés |
| **Répartition des parties** | `game_players` + `games` + `rooms.is_official/is_public` | Barre segmentée 3 couleurs (officiel / public / privé) + score cumulé par type |

#### Rangée 3 — 2 × col-6
| Carte | Données | Notes |
|---|---|---|
| **Meilleurs scores par room** | `game_players` + `rooms` officielles triées par score desc | Emoji + nom room + score max |
| **Historique récent** | 6 dernières parties : room, score, rang, date | Badge coloré 1er/2e/3e, sinon "#N" |

#### Rangée 4 — col-4 + col-4 (+ col-4 vide ou supprimé)
| Carte | Données | Notes |
|---|---|---|
| **Niveau & progression** | `profiles.level/xp` | Nom du niveau, XP ce mois, nb niveaux gagnés ce mois |
| **Score moyen** | `total_score / games_played` | + meilleur score toutes parties, meilleur rang atteint |

---

## Données requises — nouvel endpoint API

Étendre `/api/stats/[userId]` (ou créer `/api/stats/[userId]/full`) pour retourner en un seul appel :

```json
{
  "bestByRoom": { "ROOM_CODE": 890 },
  "roomInfo": { "ROOM_CODE": { "name": "Pop Français", "emoji": "🎵" } },
  "recentGames": [
    { "roomName": "Pop Français", "roomEmoji": "🎵", "score": 650, "rank": 1, "totalPlayers": 6, "endedAt": "2026-04-11T14:00:00Z" }
  ],
  "scoreByRoomType": {
    "official": { "count": 48, "totalScore": 24800 },
    "public":   { "count": 26, "totalScore": 11200 },
    "private":  { "count": 13, "totalScore": 6000 }
  },
  "winRate": { "wins": 23, "total": 87 },
  "bestScore": 890,
  "worstScore": 80,
  "bestRank": 1
}
```

Toutes ces données viennent de `game_players` + `games` + `rooms` sans nouvelle colonne Supabase.

---

## CSS

Nouveau fichier `static/css/profile.css` (remplace l'existant) avec :
- Variables réutilisant `--accent`, `--surface`, `--border`, `--bg`, `--dim` du thème global
- Grille 12 colonnes responsive (mobile : toutes les cartes passent en col-12)
- Courbe SVG inline (pas de lib chart externe)
- Badges rang colorés (or/argent/bronze)

---

## Contraintes

- Pas de nouvelle dépendance (pas de Chart.js, pas de D3)
- Courbe SVG générée dynamiquement depuis les données (`viewBox` adaptatif)
- La carte "Précision des réponses" est **exclue** (données non disponibles en BDD)
- Le profil privé (`is_private = true`) sur `/user/[username]` reste bloqué — pas de stats visibles pour les autres
- Sur `/user/[username]` : pas de bouton "Modifier", pas de modal d'édition

## Responsive (mobile-first)

- Mobile (< 700px) : toutes les cartes passent en `col-12` (colonne unique)
- Tablet (700–900px) : cartes `col-3` → `col-6`, `col-8`/`col-4` → `col-12`
- Desktop (> 900px) : grille 12 colonnes comme décrit ci-dessus
- Hero : flex-wrap, avatar + infos empilés sur mobile

## Thèmes & cohérence visuelle

- Utiliser **uniquement** les variables CSS du site : `--accent`, `--accent-rgb`, `--bg`, `--bg2`, `--surface`, `--border`, `--dim`, `--muted`, `--danger`, `--success`
- Pas de couleurs hardcodées (pas de `#a78bfa` dans le CSS final — utiliser `var(--accent)`)
- Typo : `"Bricolage Grotesque"` pour les grandes valeurs numériques (déjà utilisé sur le site)
- Bordures, border-radius, backdrop-blur cohérents avec le reste du site (`home.css`, `salon.css`)
- Les thèmes (dark/light + couleurs accent) doivent fonctionner automatiquement via les variables

---

## Fichiers à modifier

| Fichier | Action |
|---|---|
| `src/routes/(site)/api/stats/[userId]/+server.js` | Étendre avec les nouvelles agrégations |
| `src/routes/(site)/profile/+page.svelte` | Refonte complète du template |
| `src/routes/(site)/user/[username]/+page.svelte` | Refonte complète du template |
| `static/css/profile.css` | Réécriture complète |
