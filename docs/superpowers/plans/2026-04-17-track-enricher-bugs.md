# Track Enricher + Bugs SIB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger 3 bugs signalés (clavier mobile, son absent, rooms bloquées pour non-connectés) et ajouter un pipeline d'enrichissement de tracks (string parsing + MusicBrainz + Deezer) accessible depuis l'éditeur de playlists utilisateur et l'admin.

**Architecture:** Le pipeline d'enrichissement est un service Node pur (`trackEnricher.js`) appelé par deux endpoints SSE (user + admin) qui streament la progression track par track. Les données enrichies écrivent dans les colonnes `custom_*` existantes — aucune migration BDD. Le runtime de jeu est inchangé.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Node.js, MusicBrainz API (gratuit), Deezer API (existante), Supabase, SSE (ReadableStream natif)

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `src/routes/(site)/game/+page.svelte` | Fix tick() focus + unMute() safety |
| `src/routes/(site)/rooms/+page.svelte` | Retrait auth-wall non-connectés |
| `src/lib/server/services/trackEnricher.js` | **Nouveau** — pipeline complet |
| `src/routes/(site)/api/playlists/[id]/enrich/+server.js` | **Nouveau** — endpoint SSE user |
| `src/routes/(site)/api/admin/playlists/[id]/enrich/+server.js` | **Nouveau** — endpoint SSE admin |
| `src/routes/(site)/playlists/+page.svelte` | Bouton + modale progression |
| `src/routes/(admin)/admin/playlists/[id]/+page.svelte` | Bouton enrichissement admin |

---

## Task 1 — Bug : clavier mobile (focus input)

**Fichier :** `src/routes/(site)/game/+page.svelte`

- [ ] **Ajouter l'import de `tick`** (il est déjà importé ligne 2 — vérifier)

  Ligne 2 actuelle :
  ```js
  import { onMount, onDestroy, tick } from 'svelte';
  ```
  ✓ Déjà présent. Rien à faire.

- [ ] **Corriger `submitGuess()` (ligne ~203)**

  Remplacer :
  ```js
  guessVal = '';
  setTimeout(() => document.getElementById('guessInput')?.focus(), 50);
  ```
  Par :
  ```js
  guessVal = '';
  tick().then(() => document.getElementById('guessInput')?.focus());
  ```

- [ ] **Corriger le handler `round_start_sync` (ligne ~302)**

  Remplacer :
  ```js
  socket.on('round_start_sync', () => {
    _waitingForSync = false;
    syncWaiting = false;
    guessDisabled = false;
    _syncPaused = false;
    if (ytPlayer?.playVideo) ytPlayer.playVideo();
    setTimeout(() => document.getElementById('guessInput')?.focus(), 50);
  });
  ```
  Par :
  ```js
  socket.on('round_start_sync', () => {
    _waitingForSync = false;
    syncWaiting = false;
    guessDisabled = false;
    _syncPaused = false;
    if (ytPlayer?.playVideo) ytPlayer.playVideo();
    tick().then(() => document.getElementById('guessInput')?.focus());
  });
  ```

- [ ] **Commit**
  ```bash
  git add src/routes/\(site\)/game/+page.svelte
  git commit -m "fix: clavier mobile — tick() remplace setTimeout pour refocus input"
  ```

---

## Task 2 — Bug : son absent (unMute de sécurité)

**Fichier :** `src/routes/(site)/game/+page.svelte`

- [ ] **Ajouter `unMute()` et `setVolume()` explicites dans `round_start_sync`**

  Dans le handler `round_start_sync` modifié à la Task 1, ajouter avant `playVideo()` :
  ```js
  socket.on('round_start_sync', () => {
    _waitingForSync = false;
    syncWaiting = false;
    guessDisabled = false;
    _syncPaused = false;
    if (ytPlayer?.unMute) ytPlayer.unMute();
    if (ytPlayer?.setVolume) ytPlayer.setVolume(savedVol());
    if (ytPlayer?.playVideo) ytPlayer.playVideo();
    tick().then(() => document.getElementById('guessInput')?.focus());
  });
  ```

- [ ] **Commit**
  ```bash
  git add src/routes/\(site\)/game/+page.svelte
  git commit -m "fix: son absent — unMute() explicite au démarrage sync"
  ```

---

## Task 3 — Rooms accessibles aux non-connectés

**Fichier :** `src/routes/(site)/rooms/+page.svelte`

- [ ] **Remplacer le bloc conditionnel principal**

  Localiser le bloc (autour de la ligne 248) :
  ```svelte
  <div class="rooms-main">
    {#if !authReady}
      <div class="pl-loading">Chargement...</div>
    {:else if !user}
      <div class="auth-wall">
        <div class="auth-wall-icon">&#x1F512;</div>
        <h2>Connecte-toi pour acc&eacute;der aux rooms</h2>
        <p>Cr&eacute;e un compte ou connecte-toi pour cr&eacute;er et rejoindre des rooms.</p>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center">
          <button class="btn-ghost" onclick={() => openAuthModal('login')}>Connexion</button>
          <button class="btn-accent" onclick={() => openAuthModal('register')}>S&apos;inscrire</button>
        </div>
      </div>
    {:else}
      <div class="rooms-toolbar">
        {#if user}
          <button class="btn-accent sm" onclick={openCreate}>+ Créer une room</button>
        {/if}
      </div>
      <div class="rooms-tabs">
        <button class="rtab" class:active={tab === 'public'} onclick={() => switchTab('public')}>Rooms publiques</button>
        <button class="rtab" class:active={tab === 'mine'}   onclick={() => switchTab('mine')}>Mes rooms</button>
      </div>
  ```

  Remplacer par (retire le `{:else if !user}` auth-wall, masque seulement les éléments qui nécessitent une connexion) :
  ```svelte
  <div class="rooms-main">
    {#if !authReady && !user}
      <div class="pl-loading">Chargement...</div>
    {:else}
      {#if user}
        <div class="rooms-toolbar">
          <button class="btn-accent sm" onclick={openCreate}>+ Créer une room</button>
        </div>
      {/if}
      <div class="rooms-tabs">
        <button class="rtab" class:active={tab === 'public'} onclick={() => switchTab('public')}>Rooms publiques</button>
        {#if user}
          <button class="rtab" class:active={tab === 'mine'} onclick={() => switchTab('mine')}>Mes rooms</button>
        {/if}
      </div>
  ```

  Fermer le `{/if}` correspondant (qui était après `{/if}` du `{:else}`) — le reste du template reste identique, s'assurer que la balise de fermeture `</div>` de `rooms-main` est bien présente.

  Le `tab` par défaut est `'public'` donc si un non-connecté arrive, il voit directement la liste publique. Si un non-connecté était sur `tab === 'mine'` (impossible désormais puisque l'onglet est caché), aucun problème.

- [ ] **Commit**
  ```bash
  git add src/routes/\(site\)/rooms/+page.svelte
  git commit -m "fix: rooms visibles sans connexion, masque Mes rooms et Créer pour guests"
  ```

---

## Task 4 — Service trackEnricher.js

**Fichier :** `src/lib/server/services/trackEnricher.js` (nouveau)

- [ ] **Créer le fichier**

  ```js
  import { getFetch } from './fetch.js';
  import { parseFeaturing } from './playlist.js';

  const MB_USER_AGENT = 'ZIK-BlindTest/1.0 (zik-music.fr)';
  const MB_DELAY_MS = 1100;

  // ─── Patterns de bruit à supprimer du titre ───────────────────────────────────
  const NOISE_RES = [
    /\s*[\(\[]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+[^\)\]]+)?[\)\]]\s*/gi,
    /\s*-\s*(?:\d{4}\s+)?remaster(?:ed)?\s*$/gi,
    /\s*[\(\[]\s*live(?:\s+[^\)\]]+)?[\)\]]\s*/gi,
    /\s*[\(\[]\s*(?:radio|single|album)\s+edit[\)\]]\s*/gi,
    /\s*[\(\[]\s*(?:acoustic|instrumental|extended|demo|karaoke)(?:\s+[^\)\]]*)?[\)\]]\s*/gi,
    /\s*[\(\[]\s*official\s+(?:video|audio|music\s+video)[\)\]]\s*/gi,
    /\s*[\(\[]\s*(?:original|club)\s+mix[\)\]]\s*/gi,
    /\s*[\(\[]\s*deluxe(?:\s+[^\)\]]+)?[\)\]]\s*/gi,
    /\s*[\(\[]\s*\d{4}\s*[\)\]]\s*/g,
    /\s*[\(\[]\s*[\)\]]\s*/g,
  ];

  const FEAT_IN_TITLE_RE = /\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring|with|avec)\s+([^\)\]]+)[\)\]]\s*/i;

  // ─── Parse un titre brut → titre propre + feats extraits ─────────────────────
  export function parseTitle(rawTitle) {
    if (!rawTitle) return { title: '', feats: [] };
    let title = rawTitle;
    const feats = [];

    const featMatch = title.match(FEAT_IN_TITLE_RE);
    if (featMatch) {
      featMatch[1].split(/\s*[,&]\s*/).map(s => s.trim()).filter(Boolean).forEach(f => feats.push(f));
      title = title.replace(FEAT_IN_TITLE_RE, '');
    }

    for (const re of NOISE_RES) {
      title = title.replace(re, ' ');
    }
    title = title.replace(/\s+/g, ' ').trim();
    return { title, feats };
  }

  // ─── MusicBrainz ─────────────────────────────────────────────────────────────
  let _lastMbRequest = 0;

  async function mbDelay() {
    const elapsed = Date.now() - _lastMbRequest;
    if (elapsed < MB_DELAY_MS) await new Promise(r => setTimeout(r, MB_DELAY_MS - elapsed));
    _lastMbRequest = Date.now();
  }

  export async function musicBrainzLookup(artist, title) {
    if (!artist || !title) return null;
    await mbDelay();
    const fetchFn = await getFetch();
    const q = `artist:"${artist.replace(/"/g, '')}" recording:"${title.replace(/"/g, '')}"`;
    try {
      const res = await fetchFn(
        `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&limit=5&fmt=json`,
        { headers: { 'User-Agent': MB_USER_AGENT }, signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const best = (data.recordings || []).find(r => (r.score || 0) >= 85);
      if (!best) return null;

      const credits = best['artist-credit'] || [];
      const artistNames = credits.filter(c => c.artist).map(c => c.artist.name);
      const { title: mbTitle } = parseTitle(best.title || '');

      return {
        title: mbTitle || best.title || null,
        mainArtist: artistNames[0] || null,
        feats: artistNames.slice(1),
        year: best['first-release-date'] ? parseInt(best['first-release-date'].slice(0, 4)) : null,
        score: best.score,
      };
    } catch {
      return null;
    }
  }

  // ─── Deezer search ────────────────────────────────────────────────────────────
  export async function deezerSearch(artist, title) {
    if (!artist || !title) return null;
    const fetchFn = await getFetch();
    const q = `artist:"${artist.replace(/"/g, '')}" track:"${title.replace(/"/g, '')}"`;
    try {
      const res = await fetchFn(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`,
        { headers: { 'User-Agent': 'ZIK-BlindTest/1.0' }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const track = data.data?.[0];
      if (!track) return null;
      return {
        coverUrl: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || null,
        previewUrl: track.preview || null,
      };
    } catch {
      return null;
    }
  }

  // ─── Pipeline principal ───────────────────────────────────────────────────────
  export async function enrichTrack(track) {
    const rawArtist = track.custom_artist || track.artist || '';
    const rawTitle  = track.custom_title  || track.title  || '';

    // Step 1: string parse
    const { title: parsedTitle, feats: titleFeats } = parseTitle(rawTitle);
    const { main: parsedMain, feats: artistFeats }  = parseFeaturing(rawArtist);

    // Merge feats des deux sources, sans doublons
    const mergedFeats = [...new Set([...artistFeats, ...titleFeats])];

    // Step 2: MusicBrainz
    const mb = await musicBrainzLookup(parsedMain || rawArtist, parsedTitle || rawTitle);

    // Step 3: Deezer (sur les données les plus propres disponibles)
    const lookupArtist = mb?.mainArtist || parsedMain || rawArtist;
    const lookupTitle  = mb?.title      || parsedTitle || rawTitle;
    const dz = await deezerSearch(lookupArtist, lookupTitle);

    // Step 4: Merge avec scoring
    const updates = {};
    const changes = [];

    // Titre
    const finalTitle = mb?.title || parsedTitle;
    if (finalTitle && finalTitle !== rawTitle) {
      updates.custom_title = finalTitle;
      changes.push(`titre: "${rawTitle}" → "${finalTitle}"`);
    }

    // Artiste principal
    const finalArtist = mb?.mainArtist || parsedMain;
    if (finalArtist && finalArtist !== rawArtist) {
      updates.custom_artist = finalArtist;
      changes.push(`artiste: "${rawArtist}" → "${finalArtist}"`);
    }

    // Feats
    const finalFeats = mb?.feats?.length ? mb.feats : mergedFeats;
    const currentFeats = Array.isArray(track.custom_feats) ? track.custom_feats : [];
    if (
      finalFeats.length > 0 &&
      JSON.stringify([...finalFeats].sort()) !== JSON.stringify([...currentFeats].sort())
    ) {
      updates.custom_feats = finalFeats;
      const added = finalFeats.filter(f => !currentFeats.includes(f));
      changes.push(added.length ? `feat ajouté: ${added.join(', ')}` : `feats: [${finalFeats.join(', ')}]`);
    }

    // Cover (seulement si absente)
    if (dz?.coverUrl && !track.cover_url) {
      updates.cover_url = dz.coverUrl;
      changes.push('cover ajoutée');
    }

    // Preview (seulement si absent)
    if (dz?.previewUrl && !track.preview_url) {
      updates.preview_url = dz.previewUrl;
      changes.push('preview ajouté');
    }

    return { updates, changes };
  }
  ```

- [ ] **Commit**
  ```bash
  git add src/lib/server/services/trackEnricher.js
  git commit -m "feat: service trackEnricher — pipeline string/MusicBrainz/Deezer"
  ```

---

## Task 5 — Endpoint SSE user

**Fichier :** `src/routes/(site)/api/playlists/[id]/enrich/+server.js` (nouveau)

- [ ] **Créer le répertoire et le fichier**

  ```js
  import { error } from '@sveltejs/kit';
  import { requireAuth } from '$lib/server/middleware/auth.js';
  import { getAdminClient } from '$lib/server/config.js';
  import { enrichTrack } from '$lib/server/services/trackEnricher.js';

  export async function POST({ params, request }) {
    const { user } = await requireAuth(request);
    const sb = getAdminClient();

    // Vérifier propriété de la playlist
    const { data: playlist, error: plErr } = await sb
      .from('custom_playlists')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (plErr || !playlist) throw error(404, 'Playlist introuvable');
    if (playlist.owner_id !== user.id) throw error(403, 'Accès refusé');

    // Charger les tracks
    const { data: tracks } = await sb
      .from('custom_playlist_tracks')
      .select('id, artist, title, custom_artist, custom_title, custom_feats, cover_url, preview_url')
      .eq('playlist_id', params.id)
      .order('position');

    const allTracks = tracks || [];
    const total = allTracks.length;

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

        for (let i = 0; i < total; i++) {
          const track = allTracks[i];
          const label = `${track.custom_artist || track.artist} — ${track.custom_title || track.title}`;
          try {
            const { updates, changes } = await enrichTrack(track);
            if (Object.keys(updates).length > 0) {
              await sb.from('custom_playlist_tracks').update(updates).eq('id', track.id);
            }
            send({
              current: i + 1,
              total,
              track: label,
              status: changes.length > 0 ? 'enriched' : 'unchanged',
              changes,
            });
          } catch (err) {
            send({ current: i + 1, total, track: label, status: 'error', changes: [] });
          }
        }
        send({ current: total, total, status: 'done' });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
  ```

- [ ] **Commit**
  ```bash
  git add "src/routes/(site)/api/playlists/[id]/enrich/+server.js"
  git commit -m "feat: endpoint SSE enrich playlist (user)"
  ```

---

## Task 6 — Endpoint SSE admin

**Fichier :** `src/routes/(site)/api/admin/playlists/[id]/enrich/+server.js` (nouveau)

- [ ] **Créer le fichier**

  ```js
  import { error } from '@sveltejs/kit';
  import { verifyToken } from '$lib/server/middleware/auth.js';
  import { getAdminClient } from '$lib/server/config.js';
  import { enrichTrack } from '$lib/server/services/trackEnricher.js';

  export async function POST({ params, request }) {
    const token = request.headers.get('authorization')?.slice(7);
    if (!token) throw error(401, 'Token manquant');

    const user = await verifyToken(token);
    if (!user) throw error(401, 'Token invalide');

    const sb = getAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'super_admin') throw error(403, 'Accès refusé');

    const { data: tracks } = await sb
      .from('custom_playlist_tracks')
      .select('id, artist, title, custom_artist, custom_title, custom_feats, cover_url, preview_url')
      .eq('playlist_id', params.id)
      .order('position');

    const allTracks = tracks || [];
    const total = allTracks.length;

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

        for (let i = 0; i < total; i++) {
          const track = allTracks[i];
          const label = `${track.custom_artist || track.artist} — ${track.custom_title || track.title}`;
          try {
            const { updates, changes } = await enrichTrack(track);
            if (Object.keys(updates).length > 0) {
              await sb.from('custom_playlist_tracks').update(updates).eq('id', track.id);
            }
            send({
              current: i + 1,
              total,
              track: label,
              status: changes.length > 0 ? 'enriched' : 'unchanged',
              changes,
            });
          } catch (err) {
            send({ current: i + 1, total, track: label, status: 'error', changes: [] });
          }
        }
        send({ current: total, total, status: 'done' });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
  ```

- [ ] **Commit**
  ```bash
  git add "src/routes/(site)/api/admin/playlists/[id]/enrich/+server.js"
  git commit -m "feat: endpoint SSE enrich playlist (admin)"
  ```

---

## Task 7 — UI playlists : bouton + modale progression

**Fichier :** `src/routes/(site)/playlists/+page.svelte`

- [ ] **Ajouter les variables d'état pour la modale d'enrichissement** (dans le bloc `<script>`, après les autres variables d'état, vers la ligne 140)

  ```js
  // Enrichissement
  let enrichOpen    = $state(false);
  let enrichDone    = $state(false);
  let enrichTotal   = $state(0);
  let enrichCurrent = $state(0);
  let enrichLogs    = $state([]);
  ```

- [ ] **Ajouter la fonction `enrichPlaylist()`** (dans le bloc `<script>`, avant la fermeture)

  ```js
  async function enrichPlaylist() {
    enrichOpen = true;
    enrichDone = false;
    enrichTotal = 0;
    enrichCurrent = 0;
    enrichLogs = [];
    let session;
    try { session = await ensureSession(); } catch (e) { toast(e.message, 'error'); enrichOpen = false; return; }

    try {
      const response = await fetch(`/api/playlists/${editorPl.id}/enrich`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(part.slice(6));
            if (evt.status === 'done') {
              enrichDone = true;
            } else {
              enrichCurrent = evt.current;
              enrichTotal = evt.total;
              enrichLogs = [...enrichLogs, evt];
            }
          } catch {}
        }
      }
    } catch (e) {
      toast('Erreur enrichissement : ' + e.message, 'error');
      enrichOpen = false;
    }
  }
  ```

- [ ] **Ajouter le bouton dans `editor-header-actions`** (dans le template, dans la div `.editor-header-actions`)

  Remplacer :
  ```svelte
  <div class="editor-header-actions">
    <button class="btn-ghost sm" onclick={() => openPlModal(editorPl)}>Modifier</button>
    <button class="btn-accent sm" onclick={openRoomSettings}>Lancer une room &rarr;</button>
    <button class="btn-danger sm" onclick={deletePl}>Supprimer</button>
  </div>
  ```
  Par :
  ```svelte
  <div class="editor-header-actions">
    <button class="btn-ghost sm" onclick={() => openPlModal(editorPl)}>Modifier</button>
    <button class="btn-enrich sm" onclick={enrichPlaylist} title="Enrichir automatiquement les tracks (MusicBrainz + Deezer)">✨ Auto-enrichir</button>
    <button class="btn-accent sm" onclick={openRoomSettings}>Lancer une room &rarr;</button>
    <button class="btn-danger sm" onclick={deletePl}>Supprimer</button>
  </div>
  ```

- [ ] **Ajouter la modale de progression** (dans le template, après la modale `answersModalOpen`, avant le toast)

  ```svelte
  <!-- Modale enrichissement -->
  {#if enrichOpen}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal modal-lg">
      <h2>✨ Auto-enrichissement</h2>
      <p class="mdesc">
        {#if !enrichDone && enrichTotal === 0}
          Démarrage…
        {:else if !enrichDone}
          {enrichCurrent} / {enrichTotal} tracks traités…
        {:else}
          Terminé ! {enrichLogs.filter(l => l.status === 'enriched').length} tracks enrichis.
        {/if}
      </p>

      {#if enrichTotal > 0}
        <div class="enrich-progress-bar">
          <div class="enrich-progress-fill" style="width:{enrichTotal ? (enrichCurrent/enrichTotal*100) : 0}%"></div>
        </div>
      {/if}

      <div class="enrich-log">
        {#each enrichLogs as log (log.current)}
          <div class="enrich-log-row enrich-{log.status}">
            <span class="enrich-icon">
              {#if log.status === 'enriched'}✅{:else if log.status === 'error'}❌{:else}—{/if}
            </span>
            <span class="enrich-track">{log.track}</span>
            {#if log.changes?.length}
              <span class="enrich-changes">{log.changes.join(' · ')}</span>
            {/if}
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn-accent" disabled={!enrichDone} onclick={() => { enrichOpen = false; loadEditorTracks(); }}>
          {enrichDone ? 'Fermer' : 'En cours…'}
        </button>
      </div>
    </div>
  </div>
  {/if}
  ```

- [ ] **Ajouter les styles** (dans le bloc `<style>` existant)

  ```css
  /* ── Enrichissement ── */
  .btn-enrich {
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.25);
    color: var(--accent);
    padding: 8px 14px;
    border-radius: 50px;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-enrich:hover { background: rgb(var(--accent-rgb) / 0.16); }

  .enrich-progress-bar {
    height: 4px;
    background: rgb(var(--c-glass) / 0.1);
    border-radius: 99px;
    overflow: hidden;
    margin: 14px 0;
  }
  .enrich-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  .enrich-log {
    max-height: 280px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
    font-size: 0.78rem;
  }
  .enrich-log-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    background: rgb(var(--c-glass) / 0.02);
  }
  .enrich-icon { flex-shrink: 0; font-size: 0.85rem; }
  .enrich-track { font-weight: 500; flex-shrink: 0; }
  .enrich-changes { color: var(--mid); font-size: 0.72rem; }
  .enrich-error .enrich-track { color: var(--danger); }
  ```

- [ ] **Commit**
  ```bash
  git add src/routes/\(site\)/playlists/+page.svelte
  git commit -m "feat: bouton auto-enrichir + modale SSE dans éditeur playlists"
  ```

---

## Task 8 — UI admin : bouton enrichissement

**Fichier :** `src/routes/(admin)/admin/playlists/[id]/+page.svelte`

- [ ] **Lire le fichier pour localiser les boutons d'action existants**

  ```bash
  # Repérer où sont les boutons dans le template
  grep -n "btn" src/routes/\(admin\)/admin/playlists/\[id\]/+page.svelte | head -20
  ```

- [ ] **Ajouter les variables d'état et la fonction d'enrichissement** dans le `<script>` du fichier existant

  Le token admin est déjà disponible via `getContext('adminToken')` (ligne 7-8 du fichier existant). Ajouter après les variables existantes :
  ```js
  let enrichOpen    = $state(false);
  let enrichDone    = $state(false);
  let enrichTotal   = $state(0);
  let enrichCurrent = $state(0);
  let enrichLogs    = $state([]);

  async function enrichPlaylist() {
    enrichOpen = true;
    enrichDone = false;
    enrichTotal = 0;
    enrichCurrent = 0;
    enrichLogs = [];

    try {
      // token est déjà défini : const token = $derived(adminCtx?.token ?? '');
      const response = await fetch(`/api/admin/playlists/${playlist.id}/enrich`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(part.slice(6));
            if (evt.status === 'done') { enrichDone = true; }
            else { enrichCurrent = evt.current; enrichTotal = evt.total; enrichLogs = [...enrichLogs, evt]; }
          } catch {}
        }
      }
    } catch (e) {
      alert('Erreur enrichissement : ' + e.message);
      enrichOpen = false;
    }
  }
  ```

  **Note :** Avant d'écrire la fonction, lire le fichier entier pour voir comment le token admin est obtenu dans les autres interactions JS côté client (il peut être passé via un champ caché dans les forms SvelteKit). S'il n'y a pas de session Supabase côté client admin, passer le token via un champ hidden récupéré depuis le cookie de session.

- [ ] **Ajouter le bouton dans le template** (à côté des boutons d'action existants de la page)

  ```svelte
  <button class="btn-enrich" onclick={enrichPlaylist}>✨ Auto-enrichir</button>
  ```

- [ ] **Ajouter la modale de progression** (identique à celle de la Task 7, avec `data.playlist.id` au lieu de `editorPl.id`)

  ```svelte
  {#if enrichOpen}
  <div style="position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px">
    <div style="background:var(--bg2,#1a1a2e);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;width:100%;max-width:560px;max-height:80vh;overflow-y:auto">
      <h2 style="margin:0 0 8px;font-size:1.1rem">✨ Auto-enrichissement</h2>
      <p style="font-size:.82rem;color:#888;margin:0 0 14px">
        {#if !enrichDone && enrichTotal === 0}Démarrage…
        {:else if !enrichDone}{enrichCurrent} / {enrichTotal} tracks…
        {:else}Terminé — {enrichLogs.filter(l=>l.status==='enriched').length} enrichis.{/if}
      </p>
      {#if enrichTotal > 0}
        <div style="height:4px;background:rgba(255,255,255,.08);border-radius:99px;margin-bottom:14px">
          <div style="height:100%;background:#7c3aed;border-radius:99px;width:{enrichTotal?(enrichCurrent/enrichTotal*100):0}%;transition:width .3s"></div>
        </div>
      {/if}
      <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;font-size:.75rem;margin-bottom:16px">
        {#each enrichLogs as log (log.current)}
          <div style="display:flex;gap:8px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,.02)">
            <span>{log.status==='enriched'?'✅':log.status==='error'?'❌':'—'}</span>
            <span style="font-weight:500">{log.track}</span>
            {#if log.changes?.length}<span style="color:#666">{log.changes.join(' · ')}</span>{/if}
          </div>
        {/each}
      </div>
      <button disabled={!enrichDone} onclick={() => enrichOpen = false}
        style="padding:8px 20px;border-radius:8px;border:none;background:#7c3aed;color:#fff;cursor:pointer;opacity:{enrichDone?1:.5}">
        {enrichDone ? 'Fermer' : 'En cours…'}
      </button>
    </div>
  </div>
  {/if}
  ```

- [ ] **Commit**
  ```bash
  git add "src/routes/(admin)/admin/playlists/[id]/+page.svelte"
  git commit -m "feat: bouton auto-enrichir + modale SSE dans admin playlists"
  ```

---

## Task 9 — Lint et vérification finale

- [ ] **Lancer le lint**
  ```bash
  npm run lint
  ```
  Corriger toute erreur ESLint / Prettier avant de continuer.

- [ ] **Vérifier que le serveur démarre sans erreur**
  ```bash
  npm run dev
  ```
  Regarder la console : aucune erreur d'import, aucun crash.

- [ ] **Commit final si des corrections lint ont été nécessaires**
  ```bash
  git add -A
  git commit -m "style: auto-fix lint post-implémentation"
  ```

---

## Plan de tests manuel (pour Theo)

### 🐛 Bug 1 — Clavier mobile

| Action | Résultat attendu |
|---|---|
| Ouvrir `/game` sur mobile (Android Samsung ou autre) | Page charge normalement |
| Rejoindre une room, attendre le début d'une manche | L'input est focusé automatiquement |
| Taper un artiste → appuyer Entrée | Le clavier **reste ouvert** sans fermer/rouvrir |
| Taper un titre → appuyer Entrée | Idem |
| Valider via le bouton → | L'input reste focusé, clavier stable |

### 🐛 Bug 2 — Son absent

| Action | Résultat attendu |
|---|---|
| Jouer plusieurs parties d'affilée (3+) | Son présent sur chaque manche |
| Jouer avec connexion lente (3G simulé DevTools) | Son toujours présent au démarrage sync |

### 🐛 Bug 3 — Rooms pour non-connectés

| Action | Résultat attendu |
|---|---|
| Aller sur `/rooms` sans être connecté | La liste des rooms publiques s'affiche directement |
| Vérifier le header | Onglet "Mes rooms" absent, bouton "+ Créer" absent |
| Vérifier les filtres et la recherche | Fonctionnels sans connexion |
| Cliquer "Rejoindre" sur une room | Redirige vers `/game?roomId=...` (le jeu gère le guest) |
| Se connecter puis revenir sur `/rooms` | Les onglets "Mes rooms" et "+ Créer" réapparaissent |

### ✨ Enrichissement — Playlists utilisateur

| Action | Résultat attendu |
|---|---|
| Ouvrir une playlist dans l'éditeur | Bouton "✨ Auto-enrichir" visible dans le header |
| Cliquer "✨ Auto-enrichir" | Modale s'ouvre, progression démarre |
| Pendant l'enrichissement | Barre de progression avance, logs apparaissent en temps réel |
| Track enrichi via MB | Log affiche `✅ Artiste — Titre (feat: X ajouté)` |
| Track nettoyé seulement | Log affiche `✅ Artiste — Titre (titre nettoyé)` |
| Track inchangé | Log affiche `— Artiste — Titre` |
| Bouton "Fermer" | Disabled pendant l'enrichissement, actif à la fin |
| Après fermeture | La liste des tracks est rechargée (vérifier les custom_* en BDD) |
| Playlist vide (0 tracks) | Modale s'ouvre et se ferme immédiatement avec "Terminé" |

**Tests cas limites :**
- Track avec `(Remaster 2021)` dans le titre → titre propre en BDD après enrichissement
- Track `Jay-Z feat. Linkin Park` → `custom_feats: ["Linkin Park"]` si MusicBrainz le trouve
- Track sans cover → cover ajoutée depuis Deezer si trouvée
- Playlist de 50+ tracks → enrichissement va jusqu'au bout sans timeout

### ✨ Enrichissement — Admin

| Action | Résultat attendu |
|---|---|
| Aller sur `/admin/playlists/[id]` | Bouton "✨ Auto-enrichir" visible |
| Cliquer le bouton | Même comportement que côté user |
| Un utilisateur non-admin appelle `/api/admin/playlists/[id]/enrich` | Réponse 403 |

### 🔒 Sécurité

| Action | Résultat attendu |
|---|---|
| Appeler `POST /api/playlists/[id]/enrich` sans token | Réponse 401 |
| Appeler avec token d'un autre utilisateur sur une playlist qui ne lui appartient pas | Réponse 403 |
| Appeler l'endpoint admin sans être super_admin | Réponse 403 |
