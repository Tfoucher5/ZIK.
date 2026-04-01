# ZIK — Instructions pour Claude

## Projet

Application web **ZIK** (Blind Test Multijoueur) — https://www.zik-music.fr  
Stack: **SvelteKit 5** (Svelte 5 runes), Vite, Socket.io, Supabase, Node.js

## Règles générales

- Répondre en **français**
- Pas de commentaires inutiles dans le code, sauf si la logique n'est pas évidente
- Pas de refactoring non demandé, pas de features supplémentaires
- Préférer modifier un fichier existant plutôt qu'en créer un nouveau
- Ne pas ajouter de gestion d'erreur pour des cas impossibles

## Stack & conventions

- **Svelte 5 runes** : utiliser `$state`, `$derived`, `$effect`, `$props` — pas les anciens stores Svelte 4
- **SvelteKit** : load functions côté serveur dans `+page.server.js`, client dans `+page.js`
- **Socket.io** : la logique serveur est dans `src/lib/server/socket/`
- **Supabase** : client browser dans `src/lib/supabase.js`, serveur dans `src/lib/supabaseServer.js`
- **CSS** : pas de framework CSS, styles dans `static/css/` ou `<style>` scoped dans les composants

## Avant de coder

- Toujours lire le fichier avant de le modifier
- Pour les bugs Socket.io, vérifier `src/lib/server/socket/game.js` et `salon.js`
- Le state des salons est sur `globalThis.__zik_salonRooms` (survie hot-reload)

## Git

- Toujours demander confirmation avant `git push` ou `git commit`
- Branch principale : `master`

## MCPs disponibles

- **Supabase** : pour inspecter/modifier la BDD (tables, SQL, migrations)
- **Notion** : pour consulter les tâches et la doc projet
- **Vercel** : pour les déploiements et logs
