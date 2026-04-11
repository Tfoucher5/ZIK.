# ZIK v2.0 — Visual Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte visuelle complète du site ZIK en style Aurora Glass — moderne, animé, impressionnant, responsive mobile-first, cohérent sur toutes les pages.

**Architecture:** Approche Mix CSS — styles globaux partagés dans `static/css/base.css` + `animations.css`, styles spécifiques à chaque page/composant dans leur `<style>` Svelte scoped. `theme.css` (variables + thèmes) et `game.css` / `salon.css` restent dans `static/css/`. La logique Socket.io, auth, ELO et l'état des salons ne sont **jamais touchés**.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), CSS variables, backdrop-filter, IntersectionObserver, CSS animations

**Spec de référence :** `docs/superpowers/specs/2026-04-11-visual-rework-design.md`

**Note TDD :** Ce plan est entièrement visuel/CSS. Les "tests" sont : `npm run lint` (obligatoire), inspection visuelle sur `npm run dev`, et vérification viewport mobile (DevTools 375px). Chaque tâche se termine par un commit.

---

## Fichiers — Vue d'ensemble

| Fichier | Action | Responsabilité |
|---|---|---|
| `static/css/theme.css` | Inchangé | Variables CSS + 3 thèmes |
| `static/css/base.css` | **Créer** | Reset, body, nav, footer, boutons globaux, inputs, badges |
| `static/css/animations.css` | **Créer** | @keyframes, aurora blobs, scroll reveal, shimmer |
| `static/css/game.css` | Restyling subtil | Styles jeu — logique inchangée |
| `static/css/salon.css` | Restyling aurora | Styles salon — logique inchangée |
| `static/css/home.css` | **Supprimer** | Migré vers base.css + scoped styles |
| `static/css/rooms.css` | **Supprimer** | Migré dans rooms/+page.svelte |
| `static/css/playlists.css` | **Supprimer** | Migré dans playlists/+page.svelte |
| `static/css/profile.css` | **Supprimer** | Migré dans profile/+page.svelte |
| `static/css/settings.css` | **Supprimer** | Migré dans settings/+page.svelte |
| `static/css/legal.css` | **Supprimer** | Migré dans les pages légales |
| `src/lib/components/Nav.svelte` | Rework | Glassmorphism + bottom bar mobile |
| `src/lib/components/HeroSection.svelte` | **Créer** | Aurora blobs + dot grid + titre animé |
| `src/lib/components/GlassCard.svelte` | **Créer** | Card générique icon+titre+desc |
| `src/lib/components/StatCard.svelte` | **Créer** | Carte stat chiffre+label |
| `src/lib/components/RoomCard.svelte` | **Créer** | Carte room avec accent latéral |
| `src/routes/(site)/+layout.svelte` | Modifier | Charger base.css+animations.css, footer simplifié, SEO OG |
| `src/routes/(site)/+page.svelte` | Rework | Homepage Aurora Glass + SEO |
| `src/routes/(site)/rooms/+page.svelte` | Rework | Page rooms Aurora Glass |
| `src/routes/(site)/playlists/+page.svelte` | Rework | Page playlists Aurora Glass |
| `src/routes/(site)/profile/+page.svelte` | Rework | Page profil Aurora Glass |
| `src/routes/(site)/user/[username]/+page.svelte` | Rework | Profil public Aurora Glass |
| `src/routes/(site)/settings/+page.svelte` | Rework | Settings glass cards |
| `src/routes/(site)/cgu/+page.svelte` | Modifier | Supprimer home.css, style scoped |
| `src/routes/(site)/confidentialite/+page.svelte` | Modifier | Supprimer home.css, style scoped |
| `src/routes/(site)/mentions-legales/+page.svelte` | Modifier | Supprimer home.css, style scoped |
| `src/app.html` | Inchangé | theme.css déjà chargé ici |

---

## Task 1 : Commit les changements en cours

**Fichiers :** Tous les fichiers modifiés non commités (refactor CSS partiel)

- [ ] **Step 1 : Vérifier l'état git**

```bash
git status
git diff --stat
```

- [ ] **Step 2 : Commiter le travail en cours**

```bash
git add .claude/settings.local.json package.json \
  src/routes/\(site\)/+layout.svelte \
  src/routes/\(site\)/+page.svelte \
  static/css/game.css static/css/home.css static/css/rooms.css
git commit -m "refactor: standardisation variables CSS (rgba → rgb(var(--c-glass)))"
```

---

## Task 2 : Créer `static/css/base.css`

**Fichiers :**
- Créer : `static/css/base.css`

Ce fichier remplace la partie globale de `home.css` (reset, nav, footer, boutons, inputs). Il est chargé sur toutes les pages via `+layout.svelte`.

- [ ] **Step 1 : Créer `static/css/base.css`**

```css
/* ── ZIK — Base globale ──────────────────────────────────────────────────────
   Chargé sur toutes les pages (site). Contient reset, nav, footer, composants
   partagés (boutons, inputs, badges). PAS de styles page-spécifiques ici.
   Les variables de thème viennent de theme.css (chargé en amont dans app.html).
──────────────────────────────────────────────────────────────────────────── */

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: "Inter", sans-serif;
  overflow-x: hidden;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
a { text-decoration: none; color: inherit; }
img { display: block; max-width: 100%; }

/* ── Navbar ── */
#navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 200;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(16px, 4vw, 48px);
  background: var(--nav-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  transition: background 0.3s;
}
.nav-logo {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 800;
  font-size: 1.5rem;
  letter-spacing: -1px;
  color: var(--text);
}
.nav-logo span { color: var(--accent); }
.nav-right { display: flex; align-items: center; gap: 10px; }

/* Nav avatar */
.nav-avatar-wrap {
  display: flex; align-items: center; gap: 9px;
  background: none; border: none; cursor: pointer;
  color: var(--text); padding: 4px 8px; border-radius: 20px;
  transition: background 0.15s; font-family: inherit;
}
.nav-avatar-wrap:hover { background: rgb(var(--c-glass) / 0.06); }
#nav-avatar {
  width: 28px; height: 28px; border-radius: 50%; object-fit: cover;
  border: 1px solid var(--border); background: var(--surface);
}
#nav-username { font-size: 0.88rem; font-weight: 500; }
.nav-chevron { font-size: 0.65rem; color: var(--dim); }

/* Nav dropdown */
.nav-profile-wrap { position: relative; }
.nav-dropdown {
  display: none; position: absolute; top: calc(100% + 8px); right: 0;
  min-width: 160px; z-index: 300;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 12px; padding: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  flex-direction: column; gap: 2px;
}
.nav-dropdown.open { display: flex; }
.nav-dd-item {
  display: block; padding: 9px 12px; border-radius: 8px;
  font-size: 0.82rem; color: var(--text); cursor: pointer;
  transition: background 0.12s;
}
.nav-dd-item:hover { background: var(--surface2); }
.nav-dd-item.danger { color: var(--danger); }
#nav-auth { display: flex; align-items: center; gap: 8px; }

/* ── Bottom navigation bar (mobile uniquement) ── */
#bottom-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 199;
  height: 60px;
  background: var(--nav-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  grid-template-columns: repeat(4, 1fr);
  align-items: stretch;
}
.bottom-nav-item {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 3px;
  font-size: 0.6rem; font-weight: 600; letter-spacing: 0.03em;
  color: var(--mid); cursor: pointer; padding: 6px 4px;
  transition: color 0.15s; text-decoration: none;
  border-top: 2px solid transparent;
}
.bottom-nav-item.active { color: var(--accent); border-top-color: var(--accent); }
.bottom-nav-item .bn-icon { font-size: 1.1rem; }
@media (max-width: 768px) {
  #bottom-nav { display: grid; }
  /* Padding bottom sur le contenu pour ne pas être caché par la bottom bar */
  main, .page-content { padding-bottom: 60px; }
}

/* ── Boutons partagés ── */
.btn-accent {
  background: var(--accent);
  color: #000;
  border: none;
  padding: 11px 22px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: box-shadow 0.15s, transform 0.1s;
  box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.35), 0 4px 20px rgb(var(--accent-rgb) / 0.3);
}
.btn-accent:hover {
  box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.5), 0 6px 28px rgb(var(--accent-rgb) / 0.45);
  transform: translateY(-1px);
}
.btn-accent:active { transform: translateY(0); }
.btn-accent:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-accent.sm { padding: 7px 16px; font-size: 0.8rem; }
.btn-accent.full { width: 100%; justify-content: center; }

.btn-ghost {
  background: rgb(var(--c-glass) / 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border2);
  color: var(--mid);
  padding: 11px 22px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.btn-ghost:hover { background: rgb(var(--c-glass) / 0.09); color: var(--text); border-color: var(--border2); }
.btn-ghost.sm { padding: 7px 16px; font-size: 0.8rem; }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-icon {
  width: 38px; height: 38px; border-radius: 9px;
  background: rgb(var(--c-glass) / 0.05);
  border: 1px solid var(--border);
  color: var(--mid); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; transition: background 0.15s, color 0.15s;
  font-family: inherit;
}
.btn-icon:hover { background: rgb(var(--c-glass) / 0.09); color: var(--text); }

/* ── Inputs ── */
.input-glass {
  background: rgb(var(--c-glass) / 0.04);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 11px 16px;
  color: var(--text);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.input-glass::placeholder { color: var(--dim); }
.input-glass:focus {
  background: rgb(var(--c-glass) / 0.06);
  border-color: rgb(var(--accent-rgb) / 0.4);
  box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08);
}

/* ── Badges ── */
.badge-live {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgb(var(--accent-rgb) / 0.08);
  border: 1px solid rgb(var(--accent-rgb) / 0.2);
  padding: 5px 14px; border-radius: 50px;
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent);
}
.badge-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 8px var(--accent);
}

/* ── Footer ── */
.site-footer {
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, rgb(var(--c-glass) / 0.02) 0%, transparent 100%);
  padding: 28px clamp(16px, 5vw, 80px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  position: relative;
}
.site-footer::before {
  content: "";
  position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 200px; height: 1px;
  background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.25), transparent);
}
.footer-logo {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 800; font-size: 1.1rem; letter-spacing: -0.5px;
}
.footer-logo span { color: var(--accent); }
.footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
.footer-links a { font-size: 0.75rem; color: var(--dim); transition: color 0.15s; }
.footer-links a:hover { color: var(--text); }
.footer-version { font-size: 0.68rem; color: var(--dim); opacity: 0.5; }
@media (max-width: 600px) {
  .site-footer { flex-direction: column; align-items: flex-start; gap: 12px; }
  .footer-links { gap: 14px; }
}

/* ── Utilitaires ── */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
.page-pad { padding-top: calc(var(--nav-h) + 24px); }
```

- [ ] **Step 2 : Vérifier que le fichier est créé**

```bash
wc -l static/css/base.css
```
Attendu : ~200 lignes

---

## Task 3 : Créer `static/css/animations.css`

**Fichiers :**
- Créer : `static/css/animations.css`

- [ ] **Step 1 : Créer `static/css/animations.css`**

```css
/* ── ZIK — Animations & effets Aurora Glass ─────────────────────────────────
   Chargé globalement. Contient @keyframes, aurora blobs, scroll reveal,
   shimmer, dot grid. Respecte prefers-reduced-motion.
──────────────────────────────────────────────────────────────────────────── */

/* ── @keyframes ── */
@keyframes shimmer {
  to { background-position: 200% center; }
}
@keyframes blob-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(22px, -16px) scale(1.04); }
  66%       { transform: translate(-14px, 12px) scale(0.97); }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.82); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Texte gradient animé (shimmer) ── */
.text-gradient {
  background: linear-gradient(
    90deg,
    var(--accent) 0%,
    var(--accent2) 50%,
    var(--accent) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 4s linear infinite;
}

/* ── Aurora blobs ── */
.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
  animation: blob-float 9s ease-in-out infinite;
}
.aurora-blob-1 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.12) 0%, transparent 65%);
  top: -200px; left: -150px;
  animation-delay: 0s;
}
.aurora-blob-2 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgb(var(--accent2-rgb) / 0.09) 0%, transparent 65%);
  top: 80px; right: -120px;
  animation-delay: -4s;
}
.aurora-blob-3 {
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.06) 0%, transparent 65%);
  bottom: -100px; left: 35%;
  animation-delay: -7s;
}
/* Désactiver les blobs sur mobile pour les perfs */
@media (max-width: 480px) {
  .aurora-blob { display: none; }
}

/* ── Dot grid ── */
.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgb(var(--c-glass) / 0.045) 1px, transparent 1px);
  background-size: 30px 30px;
  pointer-events: none;
}
.dot-grid-fade {
  mask-image: radial-gradient(ellipse 85% 70% at 50% 30%, black 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 85% 70% at 50% 30%, black 0%, transparent 75%);
}

/* ── Scroll reveal ── */
.will-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--rd, 0ms),
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--rd, 0ms);
}
.will-reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}

/* ── Badge live dot ── */
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: pulse-glow 2s ease-in-out infinite;
  flex-shrink: 0;
}

/* ── Section hero base ── */
.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* ── Glass surface ── */
.glass {
  background: rgb(var(--c-glass) / 0.04);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.glass::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.1), transparent);
  border-radius: var(--radius) var(--radius) 0 0;
  pointer-events: none;
}

/* ── Respect prefers-reduced-motion ── */
@media (prefers-reduced-motion: reduce) {
  .will-reveal { transition: none; }
  .aurora-blob { animation: none; }
  .text-gradient { animation: none; }
  .live-dot { animation: none; }
}
```

- [ ] **Step 2 : Vérifier**

```bash
wc -l static/css/animations.css
```
Attendu : ~110 lignes

---

## Task 4 : Mettre à jour `+layout.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/+layout.svelte`

- [ ] **Step 1 : Remplacer le chargement de `home.css` par les nouveaux fichiers dans `<svelte:head>`**

Localiser (autour de la ligne 121) :
```html
<link rel="stylesheet" href="/css/home.css">
```
Remplacer par :
```html
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/animations.css">
```

- [ ] **Step 2 : Mettre à jour les meta OG dans `<svelte:head>` (SEO global)**

Remplacer le contenu des balises OG et Twitter :
```html
<meta property="og:title" content="ZIK — Blind Test Multijoueur en Ligne Gratuit">
<meta property="og:description" content="Blind test multijoueur gratuit en ligne. Spotify & Deezer, classement ELO, Mode Salon. Joue maintenant sans inscription.">
<meta name="twitter:title" content="ZIK — Blind Test Multijoueur en Ligne Gratuit">
<meta name="twitter:description" content="Blind test multijoueur gratuit. Importe tes playlists Spotify/Deezer, grimpe dans le classement ELO. Sans installation.">
```

- [ ] **Step 3 : Remplacer le footer `site-footer-full` par le nouveau footer simplifié**

Remplacer tout le bloc `<footer class="site-footer-full">…</footer>` par :
```html
<footer class="site-footer">
  <div class="footer-logo">ZIK<span>.</span></div>
  <div class="footer-links">
    <a href="/rooms">Rooms</a>
    <a href="/playlists">Playlists</a>
    <a href="/docs">Docs</a>
    <a href="/mentions-legales">Mentions légales</a>
    <a href="/cgu">CGU</a>
    <a href="/confidentialite">Confidentialité</a>
  </div>
  <span class="footer-version">v2.0.0 · <a href="/portfolio" style="color:inherit">Theo Foucher</a></span>
</footer>
```

- [ ] **Step 4 : Vérifier `npm run dev` — nav et footer s'affichent correctement**

```bash
npm run dev
```
Ouvrir http://localhost:5173, vérifier nav glassmorphism + footer simplifié sur la homepage.

- [ ] **Step 5 : Commit**

```bash
git add static/css/base.css static/css/animations.css src/routes/\(site\)/+layout.svelte
git commit -m "feat: base.css + animations.css + layout footer simplifié + SEO OG"
```

---

## Task 5 : Créer `HeroSection.svelte`

**Fichiers :**
- Créer : `src/lib/components/HeroSection.svelte`

Composant réutilisable pour les sections hero avec aurora blobs, dot grid, badge live, titre avec gradient animé, sous-titre, slot pour CTA.

- [ ] **Step 1 : Créer `src/lib/components/HeroSection.svelte`**

```svelte
<script>
  /**
   * HeroSection — Section hero Aurora Glass réutilisable
   * Props :
   *   badge      : string|null — texte du badge live (ex: "47 joueurs en ligne")
   *   title      : string      — première partie du titre (texte blanc)
   *   titleAccent: string|null — partie du titre en gradient animé
   *   subtitle   : string|null — sous-titre
   */
  let { badge = null, title, titleAccent = null, subtitle = null, children } = $props();
</script>

<section class="hero-section">
  <div class="hero-bg">
    <div class="aurora-blob aurora-blob-1"></div>
    <div class="aurora-blob aurora-blob-2"></div>
    <div class="aurora-blob aurora-blob-3"></div>
    <div class="dot-grid dot-grid-fade"></div>
  </div>

  <div class="hero-content">
    {#if badge}
      <div class="hero-badge">
        <span class="live-dot"></span>
        {badge}
      </div>
    {/if}

    <h1 class="hero-title">
      {title}{#if titleAccent}<br><em class="text-gradient">{titleAccent}</em>{/if}
    </h1>

    {#if subtitle}
      <p class="hero-sub">{subtitle}</p>
    {/if}

    {#if children}
      <div class="hero-actions">
        {@render children()}
      </div>
    {/if}
  </div>
</section>

<style>
  .hero-section {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--nav-h) + 72px) clamp(16px, 5vw, 80px) 64px;
    text-align: center;
  }
  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    max-width: 680px;
    width: 100%;
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    padding: 6px 16px;
    border-radius: 50px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    animation: fade-up 0.6s ease-out both;
  }
  .hero-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(2.6rem, 5.5vw, 4.8rem);
    font-weight: 900;
    letter-spacing: -3px;
    line-height: 1.05;
    color: var(--text);
    animation: fade-up 0.7s 0.1s ease-out both;
  }
  .hero-title em { font-style: normal; display: inline-block; }
  .hero-sub {
    font-size: clamp(0.88rem, 1.8vw, 1.05rem);
    color: var(--mid);
    max-width: 420px;
    line-height: 1.65;
    animation: fade-up 0.7s 0.2s ease-out both;
  }
  .hero-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    animation: fade-up 0.7s 0.3s ease-out both;
  }
  @media (max-width: 600px) {
    .hero-section { padding-top: calc(var(--nav-h) + 40px); padding-bottom: 40px; }
    .hero-title { letter-spacing: -2px; }
    .hero-actions { flex-direction: column; width: 100%; }
    .hero-actions :global(.btn-accent),
    .hero-actions :global(.btn-ghost) { width: 100%; justify-content: center; }
  }
</style>
```

- [ ] **Step 2 : Vérifier qu'il n'y a pas d'erreur de syntaxe Svelte**

```bash
npm run lint 2>&1 | head -30
```
Attendu : aucune erreur sur `HeroSection.svelte`

---

## Task 6 : Créer `GlassCard.svelte`, `StatCard.svelte`, `RoomCard.svelte`

**Fichiers :**
- Créer : `src/lib/components/GlassCard.svelte`
- Créer : `src/lib/components/StatCard.svelte`
- Créer : `src/lib/components/RoomCard.svelte`

- [ ] **Step 1 : Créer `src/lib/components/GlassCard.svelte`**

```svelte
<script>
  /** icon: string (emoji), title: string, description: string, href: string|null */
  let { icon = null, title, description, href = null } = $props();
  const tag = href ? 'a' : 'div';
</script>

<svelte:element this={tag} class="glass-card" {href}>
  {#if icon}<div class="gc-icon">{icon}</div>{/if}
  <div class="gc-title">{title}</div>
  <div class="gc-desc">{description}</div>
</svelte:element>

<style>
  .glass-card {
    background: rgb(var(--c-glass) / 0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px;
    position: relative;
    overflow: hidden;
    transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    display: block;
    color: var(--text);
  }
  .glass-card::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.1), transparent);
    pointer-events: none;
  }
  .glass-card:hover {
    background: rgb(var(--c-glass) / 0.065);
    border-color: var(--border2);
    transform: translateY(-3px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }
  .gc-icon { font-size: 1.5rem; margin-bottom: 12px; }
  .gc-title { font-size: 0.92rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
  .gc-desc { font-size: 0.78rem; color: var(--mid); line-height: 1.55; }
</style>
```

- [ ] **Step 2 : Créer `src/lib/components/StatCard.svelte`**

```svelte
<script>
  /** value: string, label: string, accent: boolean */
  let { value, label, accent = false } = $props();
</script>

<div class="stat-card">
  <div class="sc-val" class:sc-accent={accent}>{value}</div>
  <div class="sc-label">{label}</div>
</div>

<style>
  .stat-card {
    background: rgb(var(--c-glass) / 0.03);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 18px 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    flex: 1;
  }
  .stat-card::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 50%; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.3), transparent);
  }
  .sc-val {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1;
    color: var(--text);
    margin-bottom: 5px;
  }
  .sc-accent {
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sc-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--dim);
    font-weight: 700;
  }
</style>
```

- [ ] **Step 3 : Créer `src/lib/components/RoomCard.svelte`**

```svelte
<script>
  /**
   * room: { emoji, name, description, playerCount, maxPlayers, isOfficial, isPublic, code }
   * accentColor: string CSS (défaut var(--accent))
   * onclick: function
   */
  let { room, accentColor = 'var(--accent)', onclick = null } = $props();
</script>

<div
  class="room-card"
  style="--rc:{accentColor}"
  role="button"
  tabindex="0"
  onclick={onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
  <div class="rc-stripe"></div>
  <div class="rc-emoji">{room.emoji || '🎵'}</div>
  <div class="rc-info">
    <div class="rc-name">{room.name}</div>
    {#if room.description}
      <div class="rc-desc">{room.description}</div>
    {:else}
      <div class="rc-desc">{room.isOfficial ? 'Room officielle' : 'Room publique'}</div>
    {/if}
  </div>
  <div class="rc-count">{room.playerCount ?? 0}</div>
</div>

<style>
  .room-card {
    background: rgb(var(--c-glass) / 0.035);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s, border-color 0.2s;
    position: relative;
    overflow: hidden;
  }
  .room-card:hover {
    background: rgb(var(--c-glass) / 0.06);
    border-color: var(--border2);
    transform: translateX(3px);
  }
  .rc-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--rc, var(--accent));
    box-shadow: 0 0 10px var(--rc, var(--accent));
    border-radius: 0 2px 2px 0;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  .room-card:hover .rc-stripe { opacity: 1; }
  .rc-emoji { font-size: 1.4rem; flex-shrink: 0; }
  .rc-info { flex: 1; min-width: 0; }
  .rc-name {
    font-size: 0.88rem; font-weight: 700; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rc-desc { font-size: 0.72rem; color: var(--mid); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rc-count {
    display: flex; align-items: center;
    font-size: 0.72rem; font-weight: 700; color: var(--accent);
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.15);
    padding: 3px 10px; border-radius: 20px; flex-shrink: 0;
    min-width: 32px; justify-content: center;
  }
</style>
```

- [ ] **Step 4 : Vérifier lint**

```bash
npm run lint 2>&1 | grep -E "error|Error" | head -20
```
Attendu : aucune erreur sur les 3 nouveaux composants.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/components/HeroSection.svelte src/lib/components/GlassCard.svelte \
        src/lib/components/StatCard.svelte src/lib/components/RoomCard.svelte
git commit -m "feat: composants Aurora Glass — HeroSection, GlassCard, StatCard, RoomCard"
```

---

## Task 7 : Rework `Nav.svelte`

**Fichiers :**
- Modifier : `src/lib/components/Nav.svelte`

Ajouter la bottom navigation bar mobile. Le style glassmorphism est déjà dans `base.css` via `#navbar`. Ici on ajoute le markup de la bottom bar et l'indicateur de page active.

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat src/lib/components/Nav.svelte
```

- [ ] **Step 2 : Ajouter les props et logique pour la page active**

Dans le `<script>`, après les imports existants, ajouter :
```js
import { page } from '$app/state';
// Déterminer la section active pour la bottom nav
let activeSection = $derived(() => {
  const path = page.url.pathname;
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/rooms')) return 'rooms';
  if (path.startsWith('/playlists')) return 'playlists';
  if (path.startsWith('/profile') || path.startsWith('/user')) return 'profile';
  return '';
});
```
Note : si `page` est déjà importé dans Nav.svelte, ne pas le réimporter.

- [ ] **Step 3 : Ajouter le markup de la bottom nav bar juste avant `</svelte:fragment>` ou en fin de template**

Après le `<nav id="navbar">…</nav>` existant, ajouter :
```html
<nav id="bottom-nav" aria-label="Navigation principale">
  <a href="/" class="bottom-nav-item" class:active={activeSection() === 'home'}>
    <span class="bn-icon">🏠</span>
    Accueil
  </a>
  <a href="/rooms" class="bottom-nav-item" class:active={activeSection() === 'rooms'}>
    <span class="bn-icon">🚪</span>
    Rooms
  </a>
  <a href="/playlists" class="bottom-nav-item" class:active={activeSection() === 'playlists'}>
    <span class="bn-icon">🎵</span>
    Playlists
  </a>
  <a href="/profile" class="bottom-nav-item" class:active={activeSection() === 'profile'}>
    <span class="bn-icon">👤</span>
    Profil
  </a>
</nav>
```

- [ ] **Step 4 : Vérifier sur mobile (DevTools 375px)**

```bash
npm run dev
```
Ouvrir http://localhost:5173, passer en vue mobile 375px dans DevTools. La bottom bar doit apparaître en bas. Le lien actif doit avoir la couleur accent + bordure top.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/components/Nav.svelte
git commit -m "feat: bottom navigation bar mobile dans Nav.svelte"
```

---

## Task 8 : Rework Homepage (`+page.svelte`)

**Fichiers :**
- Modifier : `src/routes/(site)/+page.svelte`

- [ ] **Step 1 : Mettre à jour les imports en haut du `<script>`**

Ajouter après les imports existants :
```js
import HeroSection from '$lib/components/HeroSection.svelte';
import GlassCard from '$lib/components/GlassCard.svelte';
import StatCard from '$lib/components/StatCard.svelte';
import RoomCard from '$lib/components/RoomCard.svelte';
```

- [ ] **Step 2 : Mettre à jour les balises SEO dans `<svelte:head>`**

Remplacer le bloc `<title>` et `<meta name="description">` :
```html
<title>ZIK — Blind Test Multijoueur en Ligne Gratuit</title>
<meta
  name="description"
  content="Joue au blind test multijoueur gratuit en ligne. Importe tes playlists Spotify & Deezer, grimpe dans le classement ELO, joue en Mode Salon. Jeu musical en ligne sans inscription."
/>
```
Supprimer le `<link rel="stylesheet" href="/css/home.css" />` dans `<svelte:head>` (déjà chargé via layout).

- [ ] **Step 3 : Remplacer la section `<section class="hero">` par `HeroSection`**

Remplacer tout le bloc `<section class="hero">…</section>` par :
```html
<HeroSection
  badge="{displayOnline > 0 ? `${displayOnline} joueurs en ligne` : 'Blind Test Multijoueur'}"
  title="Le blind test qui"
  titleAccent="t'obsède."
  subtitle="Multijoueur, temps réel, classements ELO. Prouve que tes oreilles valent mieux que les leurs."
>
  <button class="btn-accent" onclick={() => goto('/rooms')}>Jouer maintenant →</button>
  <button class="btn-ghost" onclick={() => document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})}>Explorer les rooms</button>
</HeroSection>
```
Ajouter l'import de `goto` si pas déjà présent : `import { goto } from '$app/navigation';`

- [ ] **Step 4 : Ajouter la stats strip sous le hero**

Après `</HeroSection>`, ajouter :
```html
<div class="stats-strip">
  <div class="stats-inner">
    <StatCard value={displayOnline > 0 ? String(displayOnline) : '—'} label="Joueurs live" accent={true} />
    <div class="stat-sep"></div>
    <StatCard value={String(displayRooms || '—')} label="Rooms actives" />
    <div class="stat-sep"></div>
    <StatCard value={String(displayUsers || '—')} label="Joueurs inscrits" />
  </div>
</div>
```

- [ ] **Step 5 : Remplacer la section modes par une grille de GlassCard**

Remplacer `<section class="section modes-section">…</section>` par :
```html
<section class="section features-section" use:reveal>
  <div class="section-head will-reveal">
    <h2>Pourquoi <span class="text-gradient">ZIK</span> ?</h2>
  </div>
  <div class="features-grid">
    <div class="will-reveal" use:reveal={100}>
      <GlassCard icon="🎮" title="Multijoueur live" description="Jusqu'à 20 joueurs en simultané, classement en temps réel sur chaque manche." />
    </div>
    <div class="will-reveal" use:reveal={200}>
      <GlassCard icon="🎵" title="Spotify & Deezer" description="Importe tes playlists préférées en quelques clics. Aucune playlist = aucun blind test raté." />
    </div>
    <div class="will-reveal" use:reveal={300}>
      <GlassCard icon="📊" title="Système ELO" description="Grimpe dans les classements, surveille ta courbe de progression, compare-toi aux meilleurs." />
    </div>
    <div class="will-reveal" use:reveal={400}>
      <GlassCard icon="📺" title="Mode Salon" description="Joue en soirée sur grand écran TV. Les joueurs utilisent leur téléphone comme manette." />
    </div>
  </div>
</section>
```

- [ ] **Step 6 : Remplacer les room cards par `RoomCard.svelte`**

Dans la section `<section class="section" id="rooms">`, remplacer les cartes de rooms existantes par des `<RoomCard>` en boucle :
```html
{#each rooms.slice(0, 6) as room}
  <div class="will-reveal">
    <RoomCard
      {room}
      accentColor={room.is_official ? 'var(--accent2)' : 'var(--accent)'}
      onclick={() => handleJoin(room.code)}
    />
  </div>
{/each}
```
Conserver la logique `handleJoin` existante.

- [ ] **Step 7 : Ajouter les styles scoped en bas du fichier**

Ajouter un bloc `<style>` en fin de fichier (après le HTML) :
```html
<style>
  /* ── Stats strip ── */
  .stats-strip {
    padding: 0 clamp(16px, 5vw, 80px);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgb(var(--c-glass) / 0.025) 0%, transparent 100%);
    position: relative;
  }
  .stats-strip::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 280px; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--accent-rgb) / 0.25), transparent);
  }
  .stats-inner {
    display: flex;
    max-width: 600px;
    margin: 0 auto;
  }
  .stat-sep {
    width: 1px; background: var(--border); flex-shrink: 0; margin: 12px 0;
  }

  /* ── Sections ── */
  .section {
    padding: 72px clamp(16px, 5vw, 80px);
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  .section-head {
    margin-bottom: 36px;
  }
  .section-head h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  /* ── Features grid ── */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  /* ── Rooms grid ── */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }

  @media (max-width: 600px) {
    .section { padding: 48px 16px; }
    .stats-inner { flex-wrap: wrap; }
    .features-grid { grid-template-columns: 1fr; }
    .rooms-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 8 : Vérifier visuellement**

```bash
npm run dev
```
Vérifier : hero avec badge live animé, titre gradient, stats strip, section features en glass cards, rooms en RoomCard. Mobile 375px : CTA pleine largeur, bottom nav visible.

- [ ] **Step 9 : Lint**

```bash
npm run lint
```

- [ ] **Step 10 : Commit**

```bash
git add src/routes/\(site\)/+page.svelte
git commit -m "feat: homepage Aurora Glass — hero, stats strip, features, rooms"
```

---

## Task 9 : Rework `rooms/+page.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/rooms/+page.svelte`

- [ ] **Step 1 : Lire le fichier actuel**

```bash
wc -l src/routes/\(site\)/rooms/+page.svelte
```

- [ ] **Step 2 : Mettre à jour le `<svelte:head>`**

Remplacer les deux `<link rel="stylesheet">` par rien (on utilisera des styles scoped). Mettre à jour le `<title>` :
```html
<title>ZIK — Rooms de Blind Test en Ligne | Rejoins une Partie</title>
<meta name="description" content="Browse les rooms de blind test multijoueur en ligne ou crée la tienne. Rejoins des joueurs en live, configure ta playlist Spotify/Deezer et joue gratuitement.">
```

- [ ] **Step 3 : Ajouter `HeroSection` et `RoomCard` en import**

```js
import HeroSection from '$lib/components/HeroSection.svelte';
import RoomCard from '$lib/components/RoomCard.svelte';
```

- [ ] **Step 4 : Remplacer le header de la page par `HeroSection` compact**

Remplacer l'éventuel header/titre existant en haut du template par :
```html
<HeroSection
  title="Toutes les"
  titleAccent="rooms."
  subtitle="Rejoins une partie en cours ou crée la tienne en 30 secondes."
/>
```

- [ ] **Step 5 : Remplacer les cartes de rooms par `RoomCard`**

Dans les boucles `{#each}` des rooms officielles et publiques, remplacer le markup HTML inline de chaque carte par :
```html
<RoomCard
  {room}
  accentColor={room.is_official ? 'var(--accent2)' : 'var(--accent)'}
  onclick={() => joinRoom(room.code)}
/>
```
Conserver la logique `joinRoom` existante.

- [ ] **Step 6 : Migrer les styles de `rooms.css` et `playlists.css` (rooms en utilise) en scoped**

Ajouter en fin de fichier un bloc `<style>` avec les styles spécifiques à la page rooms (filtres, layout, section private room). Les styles de composants partagés (RoomCard) sont déjà dans leur composant Svelte.

```html
<style>
  .rooms-page { padding-top: 0; }

  .rooms-main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px clamp(16px, 4vw, 48px) 80px;
  }

  /* Filtres */
  .rooms-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 28px;
  }
  .filter-chip {
    padding: 7px 16px;
    border-radius: 50px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border2);
    background: rgb(var(--c-glass) / 0.04);
    color: var(--mid);
    transition: all 0.15s;
    font-family: inherit;
  }
  .filter-chip:hover { background: rgb(var(--c-glass) / 0.08); color: var(--text); }
  .filter-chip.active {
    background: rgb(var(--accent-rgb) / 0.1);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Grid rooms */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }

  /* Section rejoindre par code */
  .private-room-box {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: inset 0 1px 0 rgb(var(--c-glass) / 0.04);
    margin-bottom: 32px;
  }

  @media (max-width: 600px) {
    .rooms-main { padding: 20px 16px 80px; }
    .rooms-grid { grid-template-columns: 1fr; }
    .private-room-box { flex-direction: column; align-items: stretch; }
  }
</style>
```

- [ ] **Step 7 : Vérifier visuellement + mobile**

```bash
npm run dev
```
Naviguer sur `/rooms`. Vérifier : hero compact, filtres chips, cards rooms avec accent latéral, section code privé. Mobile 375px.

- [ ] **Step 8 : Commit**

```bash
git add src/routes/\(site\)/rooms/+page.svelte
git commit -m "feat: page rooms — Aurora Glass, RoomCard, styles scoped"
```

---

## Task 10 : Rework `playlists/+page.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/playlists/+page.svelte`

- [ ] **Step 1 : Mettre à jour `<svelte:head>`**

Supprimer `<link rel="stylesheet" href="/css/playlists.css">`. Mettre à jour `<title>` :
```html
<title>ZIK — Playlists de Jeu Musical en Ligne</title>
<meta name="description" content="Crée et gère tes playlists de blind test. Importe depuis Spotify ou Deezer, ajoute des titres manuellement, lance une room directement.">
```

- [ ] **Step 2 : Ajouter `HeroSection` en import et en haut du template**

```js
import HeroSection from '$lib/components/HeroSection.svelte';
```
```html
<HeroSection
  title="Tes"
  titleAccent="playlists."
  subtitle="Crée, importe, joue. Spotify, Deezer, ou manuellement."
/>
```

- [ ] **Step 3 : Remplacer les styles `playlists.css` par un `<style>` scoped en fin de fichier**

Copier les règles CSS de `static/css/playlists.css` dans un bloc `<style>` en fin de fichier, en retirant tout ce qui est déjà couvert par `base.css` (reset, boutons, inputs). Conserver les styles spécifiques aux playlists (liste, items, modales, formulaires).

- [ ] **Step 4 : Remplacer les inputs `<input>` par la classe `input-glass`**

Chercher `class="..."` sur les inputs du fichier et ajouter `input-glass` à la classe, ex :
```html
<input class="input-glass" … />
```

- [ ] **Step 5 : Vérifier visuellement + mobile**

```bash
npm run dev
```
Naviguer sur `/playlists`. Vérifier le hero, la liste, les modales.

- [ ] **Step 6 : Commit**

```bash
git add src/routes/\(site\)/playlists/+page.svelte
git commit -m "feat: page playlists — Aurora Glass, styles scoped"
```

---

## Task 11 : Rework pages profil

**Fichiers :**
- Modifier : `src/routes/(site)/profile/+page.svelte`
- Modifier : `src/routes/(site)/user/[username]/+page.svelte`

- [ ] **Step 1 : Mettre à jour `profile/+page.svelte` — `<svelte:head>`**

Supprimer `<link rel="stylesheet" href="/css/profile.css">`. Mettre à jour `<title>` :
```html
<title>ZIK — Mon Profil | Blind Test Multijoueur</title>
```

- [ ] **Step 2 : Ajouter hero aurora dans `profile/+page.svelte`**

En haut du template (sous `<svelte:head>`), avant les sections de contenu, envelopper l'avatar/hero actuel dans une section avec aurora :
```html
<div class="profile-hero">
  <div class="hero-bg">
    <div class="aurora-blob aurora-blob-1" style="opacity:0.6"></div>
    <div class="aurora-blob aurora-blob-2" style="opacity:0.4"></div>
  </div>
  <!-- avatar + nom + badge niveau existants -->
</div>
```

- [ ] **Step 3 : Migrer `profile.css` en `<style>` scoped**

Copier les règles de `static/css/profile.css` dans un bloc `<style>` en fin de `profile/+page.svelte`. Retirer les doublons avec `base.css`.

- [ ] **Step 4 : Répéter steps 1-3 pour `user/[username]/+page.svelte`**

Même traitement : supprimer le `<link>` profile.css, ajouter aurora hero, migrer styles en scoped.

- [ ] **Step 5 : Vérifier visuellement + mobile**

```bash
npm run dev
```
Naviguer sur `/profile`. Vérifier le hero aurora, les cartes stats, la courbe.

- [ ] **Step 6 : Commit**

```bash
git add src/routes/\(site\)/profile/+page.svelte src/routes/\(site\)/user/\[username\]/+page.svelte
git commit -m "feat: pages profil — Aurora Glass hero, styles scoped"
```

---

## Task 12 : Rework `settings/+page.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/settings/+page.svelte`

- [ ] **Step 1 : Mettre à jour `<svelte:head>`**

Supprimer `<link rel="stylesheet" href="/css/settings.css">`.

- [ ] **Step 2 : Migrer `settings.css` en `<style>` scoped**

Copier les règles de `static/css/settings.css` dans un bloc `<style>` en fin de fichier. Remplacer les containers par des `.glass` sections :
```html
<div class="settings-section glass">
  <!-- contenu existant -->
</div>
```

- [ ] **Step 3 : Vérifier visuellement**

```bash
npm run dev
```
Naviguer sur `/settings`. Vérifier les sections glass, le sélecteur de thème.

- [ ] **Step 4 : Commit**

```bash
git add src/routes/\(site\)/settings/+page.svelte
git commit -m "feat: settings — glass cards, styles scoped"
```

---

## Task 13 : Pages légales

**Fichiers :**
- Modifier : `src/routes/(site)/cgu/+page.svelte`
- Modifier : `src/routes/(site)/confidentialite/+page.svelte`
- Modifier : `src/routes/(site)/mentions-legales/+page.svelte`

- [ ] **Step 1 : Dans chaque page légale, supprimer les deux `<link>` CSS**

Supprimer :
```html
<link rel="stylesheet" href="/css/home.css">
<link rel="stylesheet" href="/css/legal.css">
```

- [ ] **Step 2 : Ajouter un `<style>` scoped minimal dans chaque page**

```html
<style>
  .legal-page {
    max-width: 760px;
    margin: 0 auto;
    padding: calc(var(--nav-h) + 48px) clamp(16px, 5vw, 48px) 80px;
  }
  .legal-page h1 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.8rem; font-weight: 800; letter-spacing: -1px;
    margin-bottom: 24px;
  }
  .legal-page h2 { font-size: 1.1rem; font-weight: 700; margin: 28px 0 10px; }
  .legal-page p, .legal-page li { font-size: 0.88rem; color: var(--mid); line-height: 1.75; }
  .legal-page ul { padding-left: 20px; margin: 8px 0; }
</style>
```

- [ ] **Step 3 : Commit**

```bash
git add src/routes/\(site\)/cgu/+page.svelte \
        src/routes/\(site\)/confidentialite/+page.svelte \
        src/routes/\(site\)/mentions-legales/+page.svelte
git commit -m "feat: pages légales — styles scoped, suppression liens CSS globaux"
```

---

## Task 14 : Restyling `game.css` (mode subtil)

**Fichiers :**
- Modifier : `static/css/game.css`

**Règle absolue :** on ne touche qu'aux propriétés visuelles (couleurs, backgrounds, borders, shadows). Toutes les classes, sélecteurs, z-index, layout, logique sont conservés à l'identique. Pas d'aurora blobs. Pas de dot grid. Pas de scroll reveals.

- [ ] **Step 1 : Passer en revue les hardcoded rgba restants**

```bash
grep -n "rgba\|#[0-9a-f]\{3,6\}" static/css/game.css | grep -v "var(" | head -20
```

- [ ] **Step 2 : Remplacer les backgrounds hardcodés par des variables**

Pour chaque occurrence trouvée :
- `background: rgba(18, 18, 28, 0.96)` → `background: var(--bg2)`
- `color: #fff` ou `color: white` → `color: var(--text)`
- `border-color: #...` hardcodé → `border-color: var(--border)`

- [ ] **Step 3 : Améliorer le glassmorphism des panels secondaires (chat, menu)**

Localiser `.g-chat-panel` (ou équivalent) et s'assurer :
```css
/* Exemple — adapter aux vrais sélecteurs existants */
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
background: var(--bg2);
border: 1px solid var(--border);
```

- [ ] **Step 4 : Vérifier qu'aucune classe logique n'a été modifiée**

```bash
git diff static/css/game.css | grep "^+" | grep -v "background\|color\|border\|shadow\|opacity" | head -20
```
Attendu : peu ou pas de résultats (seules les propriétés visuelles ont changé).

- [ ] **Step 5 : Tester une room en jeu**

```bash
npm run dev
```
Naviguer sur `/rooms`, rejoindre une room, vérifier que l'interface de jeu fonctionne normalement. Pas de régressions visuelles majeures.

- [ ] **Step 6 : Commit**

```bash
git add static/css/game.css
git commit -m "style: game.css — hardcoded colors → CSS variables, subtle glassmorphism"
```

---

## Task 15 : Restyling `salon.css` (aurora maximaliste)

**Fichiers :**
- Modifier : `static/css/salon.css`

**Même règle absolue que game.css** : logique de jeu intouchée. On améliore uniquement l'aspect visuel.

- [ ] **Step 1 : Identifier les zones visuelles à enrichir**

```bash
grep -n "background\|border\|box-shadow" static/css/salon.css | grep -v "var(" | head -30
```

- [ ] **Step 2 : Enrichir le fond de l'écran host**

Localiser le sélecteur principal de la vue host (ex: `.salon-host`, `.host-bg`, ou `.salon-screen`) et ajouter :
```css
.salon-host-bg {
  background: radial-gradient(ellipse 80% 60% at 20% 40%, rgb(var(--accent-rgb) / 0.08) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 80% 60%, rgb(var(--accent2-rgb) / 0.06) 0%, transparent 55%),
              var(--bg);
}
```

- [ ] **Step 3 : Renforcer le glassmorphism des overlays (résultats, fin de round)**

Sur les modales/overlays du salon, s'assurer :
```css
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: rgb(var(--c-glass) / 0.06);
border: 1px solid var(--border2);
```

- [ ] **Step 4 : Remplacer les hardcoded rgba par des variables**

Même approche que game.css — chercher/remplacer les couleurs hardcodées.

- [ ] **Step 5 : Tester le mode salon**

```bash
npm run dev
```
Naviguer sur `/salon`. Vérifier que setup, host et play fonctionnent sans régression.

- [ ] **Step 6 : Commit**

```bash
git add static/css/salon.css
git commit -m "style: salon.css — aurora renforcé sur host, glassmorphism overlays"
```

---

## Task 16 : Supprimer les anciens fichiers CSS

**Fichiers :**
- Supprimer : `static/css/home.css`, `rooms.css`, `playlists.css`, `profile.css`, `settings.css`, `legal.css`

- [ ] **Step 1 : Vérifier qu'aucun fichier ne charge encore les anciens CSS**

```bash
grep -rn "home\.css\|rooms\.css\|playlists\.css\|profile\.css\|settings\.css\|legal\.css" src/ --include="*.svelte" --include="*.html"
```
Attendu : aucun résultat. Si des occurrences restent, les supprimer avant de continuer.

- [ ] **Step 2 : Supprimer les fichiers**

```bash
rm static/css/home.css static/css/rooms.css static/css/playlists.css \
   static/css/profile.css static/css/settings.css static/css/legal.css
```

- [ ] **Step 3 : Vérifier que le site se lance toujours**

```bash
npm run dev
```
Naviguer sur `/`, `/rooms`, `/playlists`, `/profile`, `/settings`, `/cgu`. Aucune erreur 404 sur les CSS, aucune régression visuelle majeure.

- [ ] **Step 4 : Lint final**

```bash
npm run lint
```
Attendu : 0 erreurs.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "chore: suppression anciens fichiers CSS migrés en scoped styles"
```

---

## Task 17 : Mise à jour mémoire Claude

- [ ] **Step 1 : Mettre à jour `memory/MEMORY.md` et les fichiers mémoire concernés**

Mettre à jour `project_zik_setup.md` pour refléter la nouvelle architecture CSS :
- `static/css/base.css` — styles globaux (nav, footer, boutons)
- `static/css/animations.css` — Aurora Glass effects
- `static/css/theme.css` — variables + thèmes (inchangé)
- `static/css/game.css` — styles jeu
- `static/css/salon.css` — styles salon
- Styles page-spécifiques → `<style>` scoped dans chaque fichier Svelte

Créer ou mettre à jour une entrée mémoire pour les composants :
- `src/lib/components/HeroSection.svelte` — hero aurora réutilisable
- `src/lib/components/GlassCard.svelte` — card glass générique
- `src/lib/components/StatCard.svelte` — carte stat
- `src/lib/components/RoomCard.svelte` — carte room avec accent latéral

- [ ] **Step 2 : Commit**

```bash
git add memory/ docs/
git commit -m "docs: mise à jour mémoire — architecture CSS v2.0 + nouveaux composants"
```

---

## Task 18 : SEO final — Pages secondaires

**Fichiers :**
- Modifier `src/routes/(site)/playlists/+page.svelte` (title déjà fait en Task 10)
- Vérifier `src/routes/(site)/docs/+page.svelte`

- [ ] **Step 1 : Vérifier et harmoniser tous les `<title>` avec les mots-clés cibles**

```bash
grep -rn "<title>" src/routes/\(site\)/ --include="*.svelte"
```

S'assurer que :
- Homepage : `ZIK — Blind Test Multijoueur en Ligne Gratuit`
- Rooms : `ZIK — Rooms de Blind Test en Ligne | Rejoins une Partie`
- Playlists : `ZIK — Playlists de Jeu Musical en Ligne`
- Docs : `ZIK — Documentation | Blind Test Multijoueur`
- Profile : `ZIK — Mon Profil | Blind Test Multijoueur`

- [ ] **Step 2 : Vérifier les meta description de chaque page indexée**

```bash
grep -rn "name=\"description\"" src/routes/\(site\)/ --include="*.svelte" | grep -v "noindex"
```
Chaque description doit contenir au moins un des 5 mots-clés cibles et faire ≤155 caractères.

- [ ] **Step 3 : Commit**

```bash
git add src/routes/\(site\)/
git commit -m "seo: harmonisation titles + descriptions avec mots-clés cibles"
```

---

## Task 19 : Build final & vérification

- [ ] **Step 1 : Build de production**

```bash
npm run build 2>&1 | tail -20
```
Attendu : `✓ built in ...` sans erreurs.

- [ ] **Step 2 : Preview du build**

```bash
npm run preview
```
Vérifier sur http://localhost:4173 : homepage, rooms, profil, mobile 375px.

- [ ] **Step 3 : Lint complet**

```bash
npm run lint
```
Attendu : 0 erreurs, 0 warnings critiques.

- [ ] **Step 4 : Tag de version**

```bash
git tag v2.0.0
```

- [ ] **Step 5 : PR vers master**

```bash
git push origin feat/visual-refactor
# Puis créer la PR via GitHub/gh CLI
gh pr create \
  --base master \
  --title "feat: ZIK v2.0 — Visual Rework Aurora Glass" \
  --body "Refonte visuelle complète — Aurora Glass, responsive mobile-first, SEO optimisé.

## Changements
- Nouveau système CSS : base.css + animations.css + styles scoped Svelte
- Composants : HeroSection, GlassCard, StatCard, RoomCard
- Bottom navigation bar mobile
- Aurora blobs + dot grid + scroll reveals + shimmer
- Footer simplifié
- SEO : 5 mots-clés cibles, titles/descriptions optimisés
- game.css / salon.css : restyling sans toucher à la logique

## Ce qui n'a pas changé
- Logique Socket.io (game.js, salon.js)
- Auth, ELO, Supabase
- Système de thèmes (dark/light/violet)"
```

---

## Self-Review

**Couverture spec :**
- ✅ Direction Aurora Glass → Tasks 2-3 (base + animations)
- ✅ Palette inchangée → theme.css non touché
- ✅ Composants partagés → Task 5-6
- ✅ Nav + bottom bar mobile → Task 7
- ✅ Homepage → Task 8
- ✅ Rooms → Task 9
- ✅ Playlists → Task 10
- ✅ Profil → Task 11
- ✅ Settings → Task 12
- ✅ Légales → Task 13
- ✅ game.css subtil → Task 14
- ✅ salon.css maximaliste → Task 15
- ✅ Suppression anciens CSS → Task 16
- ✅ SEO 5 mots-clés → Tasks 8, 9, 10, 18
- ✅ Responsive mobile-first → Tasks 2, 7, 8 + chaque page
- ✅ prefers-reduced-motion → Task 3 (animations.css)
- ✅ Mémoire Claude mise à jour → Task 17

**Cohérence des noms :**
- `aurora-blob-1/2/3` défini dans animations.css → utilisé dans HeroSection.svelte ✅
- `text-gradient` défini dans animations.css → utilisé dans GlassCard, Homepage ✅
- `will-reveal` / `revealed` défini dans animations.css → utilisé dans homepage via `reveal()` action existante ✅
- `btn-accent` / `btn-ghost` définis dans base.css → utilisés partout ✅
- `input-glass` défini dans base.css → utilisé dans playlists, rooms ✅
- `site-footer` dans base.css → `+layout.svelte` Task 4 ✅

**Points d'attention pour l'exécutant :**
- Task 8 Step 3 : vérifier que `goto` est déjà importé dans `+page.svelte` avant d'ajouter l'import
- Task 7 Step 2 : vérifier que `page` de `$app/state` n'est pas déjà importé dans Nav.svelte
- Tasks 10-12 : "copier les règles de l'ancien CSS" — lire le fichier d'abord, ne pas supposer son contenu
- Tasks 14-15 : ne jamais renommer une classe existante de `game.css` / `salon.css`, uniquement les valeurs CSS
