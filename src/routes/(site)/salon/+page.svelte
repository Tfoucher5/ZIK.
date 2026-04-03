<script>
  import { onMount } from 'svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

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

  // Playlist picker
  let allPlaylists     = $state([]);
  let selectedPlaylist = $state(null);
  let searchQuery      = $state('');
  let creating         = $state(false);
  let error            = $state('');

  let filteredPlaylists = $derived(
    searchQuery.trim()
      ? allPlaylists.filter(p =>
          p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
      : allPlaylists
  );

  async function loadPlaylists() {
    if (!user) return;
    try {
      const [{ data: mine }, { data: official }] = await Promise.all([
        sb.from('custom_playlists')
          .select('id, name, emoji, track_count')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        sb.from('rooms')
          .select('playlist_id, name, emoji')
          .not('playlist_id', 'is', null),
      ]);

      const flat = [];
      if (mine?.length) {
        for (const p of mine) {
          flat.push({ id: p.id, name: p.name, emoji: p.emoji || '🎵', trackCount: p.track_count ?? null, group: 'Mes playlists' });
        }
      }
      if (official?.length) {
        for (const r of official) {
          flat.push({ id: r.playlist_id, name: r.name, emoji: r.emoji || '🎵', trackCount: null, group: 'Officielles' });
        }
      }
      allPlaylists = flat;
      if (!selectedPlaylist && flat.length > 0) selectedPlaylist = flat[0];
    } catch {
      error = 'Impossible de charger les playlists.';
    }
  }

  async function createSalon() {
    error = '';
    if (!selectedPlaylist) { error = 'Sélectionne une playlist.'; return; }
    creating = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Session expirée, reconnecte-toi.');
      const res = await fetch('/api/salon', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          playlistId: selectedPlaylist.id,
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
  <title>ZIK - Mode Salon</title>
  <meta name="robots" content="index, follow">
  <meta name="description" content="Créer un salon Kahoot-Like pour jouer en famille ou entre amis !">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
</svelte:head>

<div class="salon-setup">
  <button class="salon-back" onclick={() => history.back()}>← Retour</button>

  <div class="salon-setup-logo">ZIK <span>Salon</span></div>
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
            <span class="salon-range-val">{maxRounds}</span>
          </div>
        </div>

        <div class="salon-field">
          <label>Durée par manche</label>
          <div class="salon-range-row">
            <input type="range" min="15" max="60" step="5" bind:value={roundDuration}>
            <span class="salon-range-val">{roundDuration}s</span>
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
              <span class="salon-range-val">{showAnswerDuration}s</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Colonne droite : sélection playlist -->
      <div class="salon-card salon-card-playlist">
        <h2>🎵 Playlist</h2>

        {#if allPlaylists.length === 0}
          <p style="font-size:.85rem;color:var(--mid)">
            Aucune playlist disponible.
            <a href="/playlists" style="color:var(--accent2)">Crée-en une →</a>
          </p>
        {:else}
          {#if selectedPlaylist}
            <div class="salon-playlist-selected">
              <span class="salon-playlist-emoji">{selectedPlaylist.emoji}</span>
              <div class="salon-playlist-info">
                <div class="salon-playlist-name">{selectedPlaylist.name}</div>
                <div class="salon-playlist-meta">
                  {selectedPlaylist.group}
                  {#if selectedPlaylist.trackCount !== null}
                    · {selectedPlaylist.trackCount} titre{selectedPlaylist.trackCount !== 1 ? 's' : ''}
                  {/if}
                </div>
              </div>
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
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                  class="salon-playlist-item {selectedPlaylist?.id === pl.id ? 'selected' : ''}"
                  onclick={() => selectedPlaylist = pl}
                  role="option"
                  aria-selected={selectedPlaylist?.id === pl.id}
                >
                  <span class="salon-playlist-emoji">{pl.emoji}</span>
                  <div class="salon-playlist-info">
                    <div class="salon-playlist-name">{pl.name}</div>
                    <div class="salon-playlist-meta">{pl.group}</div>
                  </div>
                  {#if pl.trackCount !== null}
                    <span class="salon-playlist-count">{pl.trackCount} titres</span>
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
      <button class="btn-salon-create" onclick={createSalon} disabled={creating || !selectedPlaylist}>
        {creating ? 'Création…' : '🛋️ Créer le salon'}
      </button>
      <a href="/salon/play" class="salon-join-link">Pas l'hôte ? Rejoindre un salon →</a>
    </div>
  {/if}
</div>
