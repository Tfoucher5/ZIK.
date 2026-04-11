# ZIK v2.0 — Spec Design Visual Rework

**Date :** 2026-04-11  
**Branche :** `feat/visual-refactor`  
**Statut :** Approuvé

---

## Objectif

Refonte visuelle complète du site ZIK dans un style **Aurora Glass** — moderne, animé, impressionnant au premier chargement. Cohérence visuelle sur toutes les pages. Responsive mobile-first avec une attention particulière aux joueurs sur téléphone.

---

## Direction visuelle : Aurora Glass

### Principes

- **Fonds ultra-sombres** (`#04050a` / `#0c1018`) avec profondeur via backdrop-filter
- **Aurora blobs** : bulles de lumière floues (cyan + violet) qui flottent lentement en arrière-plan sur les pages marketing. Absentes en jeu (performance).
- **Glassmorphism** : surfaces `rgba(255,255,255,0.04)` + `backdrop-filter: blur(16px)` + bordure `rgba(255,255,255,0.08)` + shine subtil en haut (`::before` 1px gradient)
- **Dot grid** sur les sections hero : `radial-gradient` 1px masqué en fondu aux bords
- **Texte gradient** : `linear-gradient(90deg, #3ecfff, #a78bfa)` avec animation shimmer sur les titres clés uniquement
- **Scroll reveals** : éléments qui entrent en scène (`opacity 0 → 1 + translateY`) à l'intersection observer
- **Glow sur les accents** : `box-shadow` coloré sur les boutons primaires et les badges live

### Palette — inchangée

La palette existante et le système de 3 thèmes (dark, light, violet) sont conservés intégralement. L'Aurora Glass est une technique appliquée par-dessus, pas un remplacement de couleurs.

| Variable | Valeur (dark) | Usage |
|---|---|---|
| `--accent` | `#3ecfff` | Cyan — CTA, badges live, accents |
| `--accent2` | `#a78bfa` | Violet — aurora, dégradés |
| `--bg` | `#04050a` | Fond principal |
| `--bg2` | `#0c1018` | Fond secondaire |
| `--surface` | `rgba(255,255,255,0.04)` | Cards glass |
| `--border` | `rgba(255,255,255,0.08)` | Bordures |

### Typographie — inchangée

- **Inter** (400/500) — corps de texte
- **Bricolage Grotesque** (700/800/900) — titres, logo, chiffres stats

### Animations

| Zone | Niveau | Détail |
|---|---|---|
| Homepage, profil, playlists, rooms | **Maximaliste** | Blobs aurora, scroll reveals, shimmer, hover effects marqués |
| Mode Salon | **Maximaliste** | Effets visuels spectaculaires sur les écrans host/play |
| Rooms de jeu | **Subtil** | Micro-interactions uniquement, zéro décoration aurora, priorité gameplay |

`prefers-reduced-motion` respecté partout — animations désactivées si l'utilisateur a paramétré son OS en conséquence.

---

## Architecture CSS & Composants

### Approche : Mix (global + scoped)

**Règle :** Les styles partagés restent dans `static/css/`. Les styles spécifiques à une page ou un composant vivent dans le `<style>` scoped du fichier Svelte correspondant.

### Fichiers `static/css/` conservés / créés

| Fichier | Action | Contenu |
|---|---|---|
| `theme.css` | **Inchangé** | CSS variables, 3 thèmes |
| `base.css` | **Nouveau** (remplace `home.css` global) | Reset, body, nav, footer, boutons partagés (`btn-accent`, `btn-ghost`), inputs, badges, layout helpers |
| `animations.css` | **Nouveau** | `@keyframes` globaux (shimmer, blob-float, slide-up, pulse), `.will-reveal` / `.revealed`, `.aurora-blob` |
| `game.css` | **Restyling** | Styles jeu — logique inchangée, décoration aurora retirée, style subtil |
| `salon.css` | **Restyling** | Mode salon — logique inchangée, style aurora maximaliste renforcé |

### Fichiers `static/css/` supprimés

| Fichier | Migration |
|---|---|
| `home.css` | → `base.css` (global) + `<style>` dans `+page.svelte`, `HeroSection.svelte`, etc. |
| `rooms.css` | → `<style>` dans `rooms/+page.svelte` |
| `playlists.css` | → `<style>` dans `playlists/+page.svelte` |
| `profile.css` | → `<style>` dans `profile/+page.svelte` |
| `settings.css` | → `<style>` dans `settings/+page.svelte` |
| `legal.css` | → `<style>` dans les pages légales |

### Nouveaux composants Svelte

| Composant | Emplacement | Rôle |
|---|---|---|
| `HeroSection.svelte` | `src/lib/components/` | Aurora blobs + dot grid + titre animé — réutilisable sur plusieurs pages |
| `RoomCard.svelte` | `src/lib/components/` | Carte room avec accent latéral coloré, hover translateX |
| `StatCard.svelte` | `src/lib/components/` | Carte stat (chiffre + label) avec shine top |
| `GlassCard.svelte` | `src/lib/components/` | Base générique glass — icône + titre + description |
| `Nav.svelte` | `src/lib/components/` | Existant — restyling glassmorphism + bottom bar mobile |

`ProfileStats.svelte` (existant) est adapté au nouveau style sans refonte de sa logique.

---

## Pages — Changements par page

### Homepage (`+page.svelte`)

- **Hero** : badge live animé, titre avec shimmer gradient, sous-titre, 2 CTA (primaire + ghost), stats panel glass (joueurs live / parties / playlists), feats chips. Aurora blobs en fond + dot grid.
- **Section rooms actives** : grid 2 colonnes desktop / 1 colonne mobile, `RoomCard.svelte`, scroll reveal
- **Section "Pourquoi ZIK"** : grid `GlassCard.svelte` avec scroll reveal décalé
- **Supprimé** : section modes (redondante), mockup desktop dans le hero (trop lourd sur mobile)
- **Footer** : simplifié — logo + liens légaux + version, pas de footer 4 colonnes

### Navigation (`Nav.svelte`)

- **Desktop** : glassmorphism (`backdrop-filter: blur(20px)`), logo + liens + actions auth
- **Mobile** : top bar minimale (logo + burger OU bouton Jouer) + **bottom navigation bar** (Accueil / Rooms / Playlists / Profil) avec indicateur actif
- Bottom bar apparaît uniquement sur `max-width: 768px`

### Rooms (`rooms/+page.svelte`)

- Header avec aurora blob discret
- Filtres en chips glass
- Cards `RoomCard.svelte` avec scroll reveal
- Section "Rejoindre par code" : input glass stylé

### Playlists (`playlists/+page.svelte`)

- Header aurora
- Cards playlists en glass
- Modales avec glassmorphism renforcé

### Profil (`profile/+page.svelte` + `user/[username]/+page.svelte`)

- Hero avec aurora blob + avatar centré
- `ProfileStats.svelte` adapté au nouveau style
- Courbe score et historique en glass cards

### Settings (`settings/+page.svelte`)

- Layout simple, glass cards pour les sections
- Sélecteur de thème mis en valeur

### Game (`game/+page.svelte` + `game.css`)

- **Style subtil uniquement** — micro-interactions, transitions douces
- Zéro aurora blob, zéro dot grid
- Glassmorphism très léger sur les panels secondaires (chat, menu)
- Logique Socket.io et état jeu : **non touchés**

### Mode Salon (`salon/`)

- **Maximaliste** — aurora blobs renforcés sur l'écran host
- Style glassmorphism renforcé sur les overlays
- Animations plus prononcées sur les transitions de round
- Logique Socket.io et état salon : **non touchés**

---

## Responsive — Règles globales

- **Mobile-first** : on code pour 375px d'abord, on élargit avec `min-width`
- **Breakpoints** :
  - `768px` : bottom nav bar apparaît, grid 2 colonnes → 1 colonne
  - `1024px` : layout desktop complet
- **Touch targets** : 44px minimum sur tous les éléments interactifs
- **Aurora blobs** : `display: none` sous `480px` (performance)
- **Backdrop-filter** : fallback `background` opaque pour les navigateurs sans support
- **Font-size** : `clamp()` sur tous les titres pour éviter les débordements

---

## Ce qu'on ne touche pas

- Logique Socket.io (`src/lib/server/socket/game.js`, `salon.js`)
- State des salons (`globalThis.__zik_salonRooms`)
- API routes (`src/routes/(site)/api/`)
- Supabase client/serveur
- Système d'auth
- Système XP/ELO (calculs)
- SEO meta tags (on conserve les règles existantes)
