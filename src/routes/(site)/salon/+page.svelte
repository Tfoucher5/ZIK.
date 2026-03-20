<script>
  import { onMount } from 'svelte';
  import { createSupabaseClient } from '$lib/supabase.js';

  let { data } = $props();

  const sb = createSupabaseClient(data.env.supabaseUrl, data.env.supabaseAnonKey);

  let user     = $state(null);
  let authReady = $state(false);

  // Settings
  let playlistId         = $state('');
  let maxRounds          = $state(10);
  let roundDuration      = $state(30);
  let answerMode         = $state('free');
  let manualNext         = $state(false);
  let showAnswerDuration = $state(7);

  // Data
  let playlists = $state([]);
  let creating  = $state(false);
  let error     = $state('');

  async function loadPlaylists() {
    if (!user) return;
    try {
      const { data: mine } = await sb
        .from('custom_playlists')
        .select('id, name, emoji, track_count')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      const { data: official } = await sb
        .from('rooms')
        .select('playlist_id, name, emoji')
        .not('playlist_id', 'is', null);

      const merged = [];
      if (mine?.length) {
        merged.push({ group: 'Mes playlists', items: mine.map(p => ({ id: p.id, name: p.name, emoji: p.emoji || '🎵' })) });
      }
      if (official?.length) {
        merged.push({ group: 'Playlists officielles', items: official.map(r => ({ id: r.playlist_id, name: r.name, emoji: r.emoji || '🎵' })) });
      }
      playlists = merged;

      if (!playlistId && merged.length > 0 && merged[0].items.length > 0) {
        playlistId = merged[0].items[0].id;
      }
    } catch {
      error = 'Impossible de charger les playlists.';
    }
  }

  async function createSalon() {
    error = '';
    if (!playlistId) { error = 'Sélectionne une playlist.'; return; }
    creating = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Session expirée, reconnecte-toi.');
      const res = await fetch('/api/salon', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          playlistId,
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
  <title>ZIK — Mode Salon</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/salon.css">
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
    <div class="salon-card">
      <h2>🛋️ Configurer le salon</h2>

      <!-- Playlist -->
      <div class="salon-field">
        <label>Playlist</label>
        {#if playlists.length === 0}
          <p style="font-size:.85rem;color:var(--mid)">Aucune playlist disponible. <a href="/playlists" style="color:var(--accent2)">Crée-en une</a>.</p>
        {:else}
          <select bind:value={playlistId}>
            {#each playlists as group}
              <optgroup label={group.group}>
                {#each group.items as pl}
                  <option value={pl.id}>{pl.emoji} {pl.name}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        {/if}
      </div>

      <div class="salon-divider"></div>

      <!-- Nombre de manches -->
      <div class="salon-field">
        <label>Nombre de manches</label>
        <div class="salon-range-row">
          <input type="range" min="5" max="20" step="1" bind:value={maxRounds}>
          <span class="salon-range-val">{maxRounds}</span>
        </div>
      </div>

      <!-- Durée par manche -->
      <div class="salon-field">
        <label>Durée par manche</label>
        <div class="salon-range-row">
          <input type="range" min="15" max="60" step="5" bind:value={roundDuration}>
          <span class="salon-range-val">{roundDuration}s</span>
        </div>
      </div>

      <div class="salon-divider"></div>

      <!-- Mode réponse -->
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

      <!-- Avancer manuellement -->
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

      <!-- Durée d'affichage de la réponse (si auto) -->
      {#if !manualNext}
        <div class="salon-field">
          <label>Durée d'affichage de la réponse</label>
          <div class="salon-range-row">
            <input type="range" min="3" max="15" step="1" bind:value={showAnswerDuration}>
            <span class="salon-range-val">{showAnswerDuration}s</span>
          </div>
        </div>
      {/if}

      {#if error}
        <p class="salon-error">{error}</p>
      {/if}

      <button class="btn-salon-create" onclick={createSalon} disabled={creating || !playlistId}>
        {creating ? 'Création…' : '🛋️ Créer le salon'}
      </button>
    </div>
  {/if}
</div>
