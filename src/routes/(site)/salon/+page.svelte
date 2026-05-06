<script>
  import { onMount } from 'svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

  const salonJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Mode Salon — Blind Test en Soirée | ZIK",
    "description": "Organisez un blind test en soirée avec le Mode Salon ZIK. Un hôte diffuse la musique sur grand écran, les joueurs répondent depuis leur smartphone.",
    "url": "https://www.zik-music.fr/salon",
    "inLanguage": "fr-FR",
    "isPartOf": { "@type": "WebSite", "url": "https://www.zik-music.fr/", "name": "ZIK" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.zik-music.fr/" },
        { "@type": "ListItem", "position": 2, "name": "Mode Salon", "item": "https://www.zik-music.fr/salon" }
      ]
    }
  });

  let { data } = $props();

  const sb = createSupabaseClient(data.env.supabaseUrl, data.env.supabaseAnonKey);

  let user      = $state(null);
  let authReady = $state(false);

  // Paramètres du salon
  let maxRounds          = $state(10);
  let roundDuration      = $state(30);
  let answerMode         = $state('free');
  let manualNext         = $state(false);
  let showAnswerDuration = $state(7);

  // Playlist picker (multi-select)
  let allPlaylists = $state([]);
  let selectedIds  = $state([]);   // tableau d'IDs
  let searchQuery  = $state('');
  let creating     = $state(false);
  let error        = $state('');

  let filteredPlaylists = $derived(
    searchQuery.trim()
      ? allPlaylists.filter(p => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : allPlaylists
  );

  let selectedPlaylists = $derived(allPlaylists.filter(p => selectedIds.includes(p.id)));
  let totalTrackCount   = $derived(selectedPlaylists.reduce((s, p) => s + (p.trackCount || 0), 0));

  function togglePlaylist(pl) {
    if (selectedIds.includes(pl.id)) {
      selectedIds = selectedIds.filter(id => id !== pl.id);
    } else {
      selectedIds = [...selectedIds, pl.id];
    }
  }

  function clamp(val, min, max) { return Math.min(max, Math.max(min, Number(val) || min)); }

  async function loadPlaylists() {
    if (!user) return;
    try {
      const [{ data: mine }, { data: shared }] = await Promise.all([
        sb.from('custom_playlists')
          .select('id, name, emoji, track_count')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        sb.from('custom_playlists')
          .select('id, name, emoji, track_count, is_official')
          .or('is_public.eq.true,is_official.eq.true')
          .neq('owner_id', user.id)
          .order('name'),
      ]);

      const flat = [];
      if (mine?.length) {
        for (const p of mine) {
          flat.push({ id: p.id, name: p.name, emoji: p.emoji || '🎵', trackCount: p.track_count, group: 'Mes playlists' });
        }
      }
      if (shared?.length) {
        for (const p of shared) {
          if (flat.some(f => f.id === p.id)) continue;
          flat.push({ id: p.id, name: p.name, emoji: p.emoji || '🎵', trackCount: p.track_count, group: p.is_official ? 'Officielles' : 'Publiques' });
        }
      }
      allPlaylists = flat;
      if (selectedIds.length === 0 && flat.length > 0) selectedIds = [flat[0].id];
    } catch {
      error = 'Impossible de charger les playlists.';
    }
  }

  async function createSalon() {
    error = '';
    if (selectedIds.length === 0) { error = 'Sélectionne au moins une playlist.'; return; }
    creating = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Session expirée, reconnecte-toi.');
      const res = await fetch('/api/salon', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          playlistIds: selectedIds,
          settings: { maxRounds, roundDuration, answerMode, manualNext, showAnswerDuration },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur création salon');
      window.location.href = `/salon/host?code=${d.code}`;
    } catch (e) {
      error = e.message;
      creating = false;
    }
  }

  onMount(async () => {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    user = session?.user ?? null;
    authReady = true;
    if (user) loadPlaylists();

    sb.auth.onAuthStateChange((_event, session) => {
      user = session?.user ?? null;
      if (user) loadPlaylists();
    });
  });
</script>

<svelte:head>
  <title>Mode Salon — Blind Test en Soirée sur TV &amp; Smartphones | ZIK</title>
  <meta name="description" content="Organisez un blind test en soirée avec le Mode Salon ZIK. Un hôte diffuse la musique sur grand écran, les joueurs répondent depuis leur smartphone. Style Kahoot, avec vos musiques. Gratuit." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.zik-music.fr/salon" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

  <meta property="og:title" content="Mode Salon — Blind Test en Soirée | ZIK" />
  <meta property="og:description" content="Blind test en soirée : grand écran sur la TV, smartphones comme manettes. Style Kahoot avec vos playlists Spotify/Deezer. Gratuit, sans inscription." />
  <meta property="og:url" content="https://www.zik-music.fr/salon" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.zik-music.fr/og.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mode Salon — Blind Test en Soirée | ZIK" />
  <meta name="twitter:description" content="Organisez un blind test sur TV + smartphones. Style Kahoot, avec vos musiques. Gratuit." />
  <meta name="twitter:image" content="https://www.zik-music.fr/og.png" />

  <script type="application/ld+json">{@html salonJsonLd}</script>
</svelte:head>

<div class="salon-setup">
  <button class="salon-back" onclick={() => history.back()}>← Retour</button>

  <h1 class="salon-setup-logo">ZIK <span>Salon</span></h1>
  <p class="salon-setup-sub">Mode soirée — comme Kahoot, depuis la TV</p>

  {#if !authReady}
    <div class="salon-card" style="text-align:center;color:var(--mid)">Chargement…</div>

  {:else if !user}
    <div class="salon-card" style="text-align:center">
      <p style="margin-bottom:16px;color:var(--mid)">Connecte-toi pour créer un salon.</p>
      <a href="/" class="btn-salon-create" style="display:inline-block;text-decoration:none">Retour à l'accueil</a>
    </div>

  {:else}
    <div class="salon-setup-grid">

      <!-- Colonne gauche : paramètres -->
      <div class="salon-card salon-card-params">
        <h2>⚙️ Paramètres</h2>

        <div class="salon-field">
          <label>Nombre de manches</label>
          <div class="salon-range-row">
            <input type="range" min="5" max="20" step="1" bind:value={maxRounds}>
            <input type="number" min="5" max="20" step="1" class="salon-range-num" bind:value={maxRounds}
              onchange={() => maxRounds = clamp(maxRounds, 5, 20)}>
          </div>
        </div>

        <div class="salon-field">
          <label>Durée par manche</label>
          <div class="salon-range-row">
            <input type="range" min="15" max="60" step="5" bind:value={roundDuration}>
            <input type="number" min="15" max="60" step="5" class="salon-range-num" bind:value={roundDuration}
              onchange={() => roundDuration = clamp(roundDuration, 15, 60)}>
            <span class="salon-range-unit">s</span>
          </div>
        </div>

        <div class="salon-divider"></div>

        <div class="salon-field">
          <label>Mode réponse</label>
          <div class="salon-mode-btns">
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="salon-mode-btn {answerMode === 'free' ? 'selected' : ''}" onclick={() => answerMode = 'free'}>
              <span class="mode-icon">⌨️</span>
              <div class="mode-name">Texte libre</div>
              <div class="mode-desc">Pur savoir, aucun hasard</div>
            </div>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="salon-mode-btn {answerMode === 'multiple' ? 'selected' : ''}" onclick={() => answerMode = 'multiple'}>
              <span class="mode-icon">🎯</span>
              <div class="mode-name">Choix multiples</div>
              <div class="mode-desc">4 options, une seule bonne</div>
            </div>
          </div>
        </div>

        <div class="salon-divider"></div>

        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="salon-field">
          <div class="salon-toggle-row" onclick={() => manualNext = !manualNext}>
            <div>
              <div class="salon-toggle-label">Avancer manuellement</div>
              <div class="salon-toggle-desc">L'hôte clique pour passer à la manche suivante</div>
            </div>
            <div class="salon-toggle {manualNext ? 'on' : ''}"></div>
          </div>
        </div>

        {#if !manualNext}
          <div class="salon-field">
            <label>Durée d'affichage de la réponse</label>
            <div class="salon-range-row">
              <input type="range" min="3" max="15" step="1" bind:value={showAnswerDuration}>
              <input type="number" min="3" max="15" step="1" class="salon-range-num" bind:value={showAnswerDuration}
                onchange={() => showAnswerDuration = clamp(showAnswerDuration, 3, 15)}>
              <span class="salon-range-unit">s</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Colonne droite : sélection playlists (multi) -->
      <div class="salon-card salon-card-playlist">
        <h2>🎵 Playlists</h2>

        {#if allPlaylists.length === 0}
          <p style="font-size:.85rem;color:var(--mid)">
            Aucune playlist disponible.
            <a href="/playlists" style="color:var(--accent2)">Crée-en une →</a>
          </p>
        {:else}
          <!-- Chips des playlists sélectionnées -->
          {#if selectedPlaylists.length > 0}
            <div class="salon-playlist-chips">
              {#each selectedPlaylists as pl (pl.id)}
                <div class="salon-playlist-chip">
                  <span>{pl.emoji} {pl.name}</span>
                  <button class="salon-chip-remove" onclick={() => togglePlaylist(pl)} aria-label="Retirer {pl.name}">×</button>
                </div>
              {/each}
            </div>
            <div class="salon-playlist-total">
              {totalTrackCount} titre{totalTrackCount !== 1 ? 's' : ''} au total
            </div>
          {/if}

          <input
            class="salon-playlist-search"
            type="search"
            placeholder="Rechercher une playlist…"
            bind:value={searchQuery}
            autocomplete="off"
          >

          <div class="salon-playlist-list">
            {#if filteredPlaylists.length === 0}
              <p style="font-size:.82rem;color:var(--dim);padding:8px 4px">Aucun résultat.</p>
            {:else}
              {#each filteredPlaylists as pl (pl.id)}
                {@const isSelected = selectedIds.includes(pl.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                  class="salon-playlist-item {isSelected ? 'selected' : ''}"
                  onclick={() => togglePlaylist(pl)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span class="salon-playlist-emoji">{pl.emoji}</span>
                  <div class="salon-playlist-info">
                    <div class="salon-playlist-name">{pl.name}</div>
                    <div class="salon-playlist-meta">{pl.group}</div>
                  </div>
                  {#if pl.trackCount}
                    <span class="salon-playlist-count">{pl.trackCount} titres</span>
                  {/if}
                  {#if isSelected}
                    <span class="salon-playlist-check">✓</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

    </div>

    {#if error}
      <p class="salon-error" style="margin-top:12px">{error}</p>
    {/if}

    <div class="salon-setup-actions">
      <button class="btn-salon-create" onclick={createSalon} disabled={creating || selectedIds.length === 0}>
        {creating ? 'Création…' : '🛋️ Créer le salon'}
      </button>
      <a href="/salon/play" class="salon-join-link">Pas l'hôte ? Rejoindre un salon →</a>
    </div>
  {/if}
</div>
