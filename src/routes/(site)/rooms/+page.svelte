<script>
  import { onMount, getContext } from 'svelte';
  import HeroSection from '$lib/components/HeroSection.svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let tab              = $state('public');
  let pubSearch        = $state('');
  let filterAutoStart  = $state(false);
  let filterActive     = $state(false);

  const filteredPublic = $derived.by(() => {
    let list = publicRooms;
    if (pubSearch.trim()) {
      const q = pubSearch.trim().toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.profiles?.username?.toLowerCase().includes(q)
      );
    }
    if (filterAutoStart) list = list.filter(r => r.auto_start);
    if (filterActive)    list = list.filter(r => r.last_active_at && (Date.now() - new Date(r.last_active_at).getTime()) < 3_600_000);
    return list;
  });
  let publicRooms  = $state([]);
  let myRooms      = $state([]);
  let pubLoading  = $state(true);
  let mineLoading = $state(false);

  // Room modal
  let roomModalOpen   = $state(false);
  let editingRoomId   = $state(null);
  let editingCode     = $state(null);
  let roomName        = $state('');
  let roomEmoji       = $state('&#x1F3B5;');
  let roomDesc        = $state('');
  let roomPlaylistIds = $state([]);
  let roomMaxRounds   = $state(10);
  let roomDuration    = $state(30);
  let roomBreak       = $state(7);
  let roomPublic      = $state(true);
  let roomAutoStart   = $state(false);
  let roomError       = $state('');
  let roomSaving      = $state(false);

  // Playlist picker dans la modal
  let allPlaylists     = $state([]);
  let plSearch         = $state('');
  let filteredPlaylists = $derived(
    plSearch.trim()
      ? allPlaylists.filter(p => p.name.toLowerCase().includes(plSearch.trim().toLowerCase()))
      : allPlaylists
  );
  let selectedPlaylists  = $derived(allPlaylists.filter(p => roomPlaylistIds.includes(p.id)));
  let totalTrackCount    = $derived(selectedPlaylists.reduce((s, p) => s + (p.track_count || 0), 0));

  // Delete modal
  let deleteModalOpen = $state(false);
  let deletingRoomId  = $state(null);
  let deleteLoading   = $state(false);

  let toastMsg  = $state('');
  let toastType = $state('');
  let _tt = null;
  function toast(msg, type = '') {
    clearTimeout(_tt); toastMsg = msg; toastType = type;
    _tt = setTimeout(() => { toastMsg = ''; }, 3500);
  }

  onMount(() => { loadPublicRooms(); });

  // Reload my rooms when user auth resolves after page load
  let _lastRoomsUid = null;
  $effect(() => {
    const uid = user?.id;
    if (uid && uid !== _lastRoomsUid && sb) {
      _lastRoomsUid = uid;
      if (tab === 'mine') loadMyRooms();
    }
  });

  async function getToken() {
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || null;
  }

  async function loadPublicRooms() {
    pubLoading = true;
    try {
      const token = user ? await getToken() : null;
      const r = await fetch('/api/rooms', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      publicRooms = r.ok ? await r.json() : [];
    } catch { publicRooms = []; }
    pubLoading = false;
  }

  async function loadMyRooms() {
    if (!user) return;
    mineLoading = true;
    try {
      const token = await getToken();
      const r = await fetch('/api/rooms/mine', { headers: { Authorization: `Bearer ${token}` } });
      myRooms = r.ok ? await r.json() : [];
    } catch { myRooms = []; }
    mineLoading = false;
  }

  function switchTab(t) {
    tab = t;
    if (t === 'mine' && !myRooms.length) loadMyRooms();
  }

  async function loadPlaylists() {
    if (!user || !sb) return;
    try {
      const [{ data: mine }, { data: shared }] = await Promise.all([
        sb.from('custom_playlists').select('id, name, emoji, track_count').eq('owner_id', user.id).order('name'),
        sb.from('custom_playlists').select('id, name, emoji, track_count, is_official').or('is_public.eq.true,is_official.eq.true').neq('owner_id', user.id).order('name'),
      ]);
      const flat = [];
      for (const p of mine || []) flat.push({ id: p.id, name: p.name, emoji: p.emoji || '🎵', track_count: p.track_count, group: 'Mes playlists' });
      for (const p of shared || []) {
        if (flat.some(f => f.id === p.id)) continue;
        flat.push({ id: p.id, name: p.name, emoji: p.emoji || '🎵', track_count: p.track_count, group: p.is_official ? 'Officielles' : 'Publiques' });
      }
      allPlaylists = flat;
    } catch { allPlaylists = []; }
  }

  function togglePlaylist(pl) {
    if (roomPlaylistIds.includes(pl.id)) {
      roomPlaylistIds = roomPlaylistIds.filter(id => id !== pl.id);
    } else {
      roomPlaylistIds = [...roomPlaylistIds, pl.id];
    }
  }

  function joinRoom(code) {
    const username = user?.profile?.username || user?.email?.split('@')[0] || 'Joueur';
    const userId   = user?.id || '';
    const isGuest  = user ? '0' : '1';
    const p = new URLSearchParams({ roomId: code, username, userId, isGuest });
    window.location.href = `/game?${p}`;
  }

  async function openCreate() {
    if (!user) { openAuthModal('login'); return; }
    await loadPlaylists();
    editingRoomId = null; editingCode = null;
    roomName = ''; roomEmoji = '🎵'; roomDesc = '';
    roomPlaylistIds = []; plSearch = '';
    roomMaxRounds = 10; roomDuration = 30; roomBreak = 7; roomPublic = true; roomAutoStart = false;
    roomError = '';
    roomModalOpen = true;
  }

  async function openEdit(code, id) {
    if (!user) return;
    await loadPlaylists();
    editingRoomId = id; editingCode = code;
    plSearch = '';
    try {
      const token = await getToken();
      const r = await fetch(`/api/rooms/${code}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const room = await r.json();
      roomName = room.name || ''; roomEmoji = room.emoji || '🎵'; roomDesc = room.description || '';
      roomPlaylistIds = room.playlist_ids || [];
      roomMaxRounds = room.max_rounds || 10;
      roomDuration = room.round_duration || 30; roomBreak = room.break_duration || 7;
      roomPublic = room.is_public !== false;
      roomAutoStart = room.auto_start || false;
      roomError = '';
      roomModalOpen = true;
    } catch (e) { toast('Impossible de charger la room : ' + e.message, 'error'); }
  }

  async function saveRoom() {
    if (!roomName.trim()) { roomError = 'Le nom est requis.'; return; }
    if (!roomPlaylistIds.length) { roomError = 'S\u00e9lectionne au moins une playlist.'; return; }
    roomSaving = true; roomError = '';
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expir\u00e9e, reconnecte-toi.');
      const body = {
        name: roomName, emoji: roomEmoji || '🎵', description: roomDesc,
        playlist_ids: roomPlaylistIds, is_public: roomPublic,
        max_rounds: roomMaxRounds, round_duration: roomDuration, break_duration: roomBreak,
        auto_start: roomAutoStart,
      };
      const r = editingRoomId
        ? await fetch(`/api/rooms/${editingRoomId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
        : await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      toast(editingRoomId ? 'Room mise \u00e0 jour !' : `Room cr\u00e9\u00e9e ! Code : ${d.code}`, 'success');
      roomModalOpen = false;
      loadPublicRooms();
      if (tab === 'mine') loadMyRooms();
    } catch (e) { roomError = e.message; }
    roomSaving = false;
  }

  function askDelete(id) { deletingRoomId = id; deleteModalOpen = true; }

  async function confirmDelete() {
    if (!deletingRoomId) return;
    deleteLoading = true;
    try {
      const token = await getToken();
      const r = await fetch(`/api/rooms/${deletingRoomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      toast('Room supprim\u00e9e.', 'success');
      deleteModalOpen = false; deletingRoomId = null;
      loadPublicRooms(); loadMyRooms();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
    deleteLoading = false;
  }
</script>

<svelte:head>
  <title>ZIK — Rooms de Blind Test en Ligne | Rejoins une Partie</title>
  <meta name="description" content="Browse les rooms de blind test multijoueur en ligne ou crée la tienne. Rejoins des joueurs en live, configure ta playlist Spotify/Deezer et joue gratuitement.">
  <link rel="canonical" href="https://www.zik-music.fr/rooms">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title" content="ZIK — Rooms de Blind Test">
  <meta property="og:description" content="Browse les rooms de blind test multijoueur en ligne ou crée la tienne. Rejoins des joueurs en live, configure ta playlist Spotify/Deezer et joue gratuitement.">
  <meta property="og:url" content="https://www.zik-music.fr/rooms">

  <!-- Twitter Card -->
  <meta name="twitter:title" content="ZIK — Rooms de Blind Test">
  <meta name="twitter:description" content="Browse les rooms de blind test multijoueur en ligne ou crée la tienne. Rejoins des joueurs en live.">
</svelte:head>

<HeroSection
  title="Toutes les"
  titleAccent="rooms."
  subtitle="Rejoins une partie en cours ou crée la tienne en 30 secondes."
/>

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

    {#if tab === 'public'}
      <div class="rooms-search-wrap">
        <input class="input-glass rooms-search" type="search" bind:value={pubSearch} placeholder="Rechercher une room..." />
      </div>
      <div class="rooms-filters">
        <button
          class="filter-chip"
          class:active={filterAutoStart}
          onclick={() => filterAutoStart = !filterAutoStart}
        >⚡ Lancement auto</button>
        <button
          class="filter-chip"
          class:active={filterActive}
          onclick={() => filterActive = !filterActive}
        >🔴 Joueurs actifs</button>
        {#if filterAutoStart || filterActive}
          <button class="filter-chip filter-chip-reset" onclick={() => { filterAutoStart = false; filterActive = false; }}>
            ✕ Réinitialiser
          </button>
        {/if}
      </div>
      {#if pubLoading}
        <div class="pl-loading">Chargement...</div>
      {:else if !publicRooms.length}
        <div class="rooms-empty"><span>&#x1F30E;</span><p>Aucune room publique pour l&apos;instant.<br>Sois le premier &agrave; en cr&eacute;er une !</p></div>
      {:else}
        <div class="rooms-grid">
          {#each filteredPublic as r (r.id)}
            <div class="room-card {r.is_official ? 'room-card-official' : ''}">
              <div class="room-card-head">
                <span class="room-card-emoji">{r.emoji}</span>
                <div style="flex:1;min-width:0">
                  <div class="room-card-name">
                    {r.name}
                    {#if r.is_official}<span class="room-badge-official">✓ Officielle</span>{/if}
                  </div>
                  {#if r.profiles?.username}<div class="room-card-owner">par {r.profiles.username}</div>{/if}
                </div>
              </div>
              {#if r.description}<p class="room-card-desc">{r.description}</p>{/if}
              <div class="room-card-meta">
                <span class="room-card-tag">{r.max_rounds} manches</span>
                <span class="room-card-tag">{r.round_duration}s/manche</span>
                {#if r.track_count > 0}<span class="room-card-tag">🎵 {r.track_count} titres</span>{/if}
                {#if r.online > 0}<span class="room-card-tag room-card-online">🟢 {r.online} en ligne</span>{/if}
                {#if r.auto_start}<span class="room-card-tag room-card-auto">⚡ Auto</span>{/if}
                <span class="room-card-tag">Code&nbsp;<strong>{r.code}</strong></span>
                {#if !r.is_public}<span class="room-card-tag room-card-private">Priv&eacute;e</span>{/if}
              </div>
              <div class="room-card-footer">
                <button class="btn-accent sm" onclick={() => joinRoom(r.code)}>Rejoindre</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      {#if mineLoading}
        <div class="pl-loading">Chargement...</div>
      {:else if !myRooms.length}
        <div class="rooms-empty">
          <span>&#x1F3AE;</span>
          <p>Tu n&apos;as pas encore cr&eacute;e de room.<br>Lance-toi !</p>
          <button class="btn-accent sm" onclick={openCreate} style="margin-top:16px">+ Cr&eacute;er une room</button>
        </div>
      {:else}
        <div class="rooms-grid">
          {#each myRooms as r (r.id)}
            <div class="room-card">
              <div class="room-card-head">
                <span class="room-card-emoji">{r.emoji}</span>
                <div><div class="room-card-name">{r.name}</div></div>
              </div>
              {#if r.description}<p class="room-card-desc">{r.description}</p>{/if}
              <div class="room-card-meta">
                <span class="room-card-tag">{r.max_rounds} manches</span>
                <span class="room-card-tag">{r.round_duration}s/manche</span>
                {#if r.track_count > 0}<span class="room-card-tag">🎵 {r.track_count} titres</span>{/if}
                {#if r.online > 0}<span class="room-card-tag room-card-online">🟢 {r.online} en ligne</span>{/if}
                <span class="room-card-tag">Code&nbsp;<strong>{r.code}</strong></span>
                {#if !r.is_public}<span class="room-card-tag room-card-private">Priv&eacute;e</span>{/if}
              </div>
              <div class="room-card-footer">
                <button class="btn-accent sm" onclick={() => joinRoom(r.code)}>Rejoindre</button>
                <div class="room-card-actions">
                  <button class="btn-ghost sm" onclick={() => openEdit(r.code, r.id)}>Modifier</button>
                  <button class="btn-delete-room" onclick={() => askDelete(r.id)}>Supprimer</button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<!-- Room modal -->
{#if roomModalOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) roomModalOpen = false; }}>
  <div class="modal modal-lg">
    <button class="close-btn" onclick={() => roomModalOpen = false}>&#x2715;</button>
    <h2>{editingRoomId ? 'Modifier la room' : 'Cr\u00e9er une room'}</h2>
    <p class="mdesc">{editingRoomId ? `Code : ${editingCode}` : 'Configure ta room et partage le code \u00e0 tes amis.'}</p>

    <div style="display:flex;gap:12px;align-items:flex-end">
      <div class="field" style="width:72px;flex-shrink:0">
        <label for="emoji">Emoji</label>
        <input type="text" bind:value={roomEmoji} maxlength="2" style="text-align:center;font-size:1.5rem;padding:8px">
      </div>
      <div class="field" style="flex:1">
        <label for="nomRoom">Nom de la room</label>
        <input type="text" bind:value={roomName} placeholder="Ma super room" maxlength="60">
      </div>
    </div>

    <div class="field">
      <label for="description">Description <span style="font-weight:400;text-transform:none;letter-spacing:0">(optionnel)</span></label>
      <input type="text" bind:value={roomDesc} placeholder="Un petit mot pour d\u00e9crire la room..." maxlength="200">
    </div>

    <div class="field">
      <label for="pl-search">Playlists
        {#if roomPlaylistIds.length > 0}
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--accent)">
            ({roomPlaylistIds.length} sélectionnée{roomPlaylistIds.length > 1 ? 's' : ''} · {totalTrackCount} titres)
          </span>
        {/if}
      </label>
      <input
        id="pl-search"
        type="search"
        bind:value={plSearch}
        placeholder="Rechercher une playlist..."
        style="margin-bottom:6px"
      />
      <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border, rgba(255,255,255,.1));border-radius:8px;padding:4px 0">
        {#if filteredPlaylists.length === 0}
          <div style="padding:10px 14px;font-size:.8rem;color:var(--dim)">Aucune playlist trouvée.</div>
        {:else}
          {#each filteredPlaylists as pl (pl.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_interactive_supports_focus -->
            <div
              role="option"
              aria-selected={roomPlaylistIds.includes(pl.id)}
              class="pl-picker-row"
              class:selected={roomPlaylistIds.includes(pl.id)}
              onclick={() => togglePlaylist(pl)}
            >
              <span class="pl-picker-check">{roomPlaylistIds.includes(pl.id) ? '✓' : ''}</span>
              <span>{pl.emoji} {pl.name}</span>
              {#if pl.group !== 'Mes playlists'}<span class="pl-picker-group">{pl.group}</span>{/if}
              <span class="pl-picker-count">{pl.track_count ?? 0} titres</span>
            </div>
          {/each}
        {/if}
      </div>
      <p style="font-size:.75rem;color:var(--dim);margin-top:4px">Au moins 3 titres requis au total. <a href="/playlists" style="color:var(--accent)">Gérer mes playlists</a></p>
    </div>

    <div style="display:flex;gap:14px">
      <div class="field" style="flex:1"><label for="manches">Manches</label><input type="number" bind:value={roomMaxRounds} min="3" max="50"></div>
      <div class="field" style="flex:1"><label for="dureeManche">Dur&eacute;e/manche (s)</label><input type="number" bind:value={roomDuration} min="10" max="60"></div>
      <div class="field" style="flex:1"><label for="pauseManche">Pause (s)</label><input type="number" bind:value={roomBreak} min="3" max="15"></div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:.875rem">
      <input type="checkbox" id="room-is-public" bind:checked={roomPublic} style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">
      <label for="room-is-public" style="cursor:pointer">Room publique (visible dans le browse)</label>
    </div>

    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:20px;font-size:.875rem">
      <input type="checkbox" id="room-auto-start" bind:checked={roomAutoStart} style="width:16px;height:16px;margin-top:2px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
      <div>
        <label for="room-auto-start" style="cursor:pointer;display:block">Lancement automatique</label>
        {#if roomAutoStart}
          <span style="font-size:.75rem;color:var(--mid)">La partie d&eacute;marre automatiquement (5&nbsp;s) d&egrave;s qu&apos;un joueur rejoint la room.</span>
        {:else}
          <span style="font-size:.75rem;color:var(--mid)">Lancement manuel &mdash; seul l&apos;administrateur peut d&eacute;marrer la partie. Les autres joueurs verront un message d&apos;attente.</span>
        {/if}
      </div>
    </div>

    {#if roomError}<div class="alert-err">{roomError}</div>{/if}

    {#if !editingRoomId}
    <div style="display:flex;gap:10px;align-items:flex-start;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);border-radius:10px;padding:12px 14px;font-size:.78rem;color:var(--mid);line-height:1.5;margin-bottom:16px">
      <span style="flex-shrink:0;font-size:1rem">&#x1F4A1;</span>
      <div>
        Cette room est <strong style="color:var(--text)">permanente</strong> et restera accessible &agrave; tous.
        Tu veux lancer une partie rapide depuis une playlist sans cr&eacute;er de room ?
        <a href="/playlists" style="color:var(--accent);text-decoration:underline">Lance une room &eacute;ph&eacute;m&egrave;re depuis tes playlists</a>.
      </div>
    </div>
    {/if}

    <div class="modal-footer">
      <button class="btn-ghost" onclick={() => roomModalOpen = false}>Annuler</button>
      <button class="btn-accent full" onclick={saveRoom} disabled={roomSaving} style="width:auto;margin:0">
        {roomSaving ? '...' : editingRoomId ? 'Enregistrer' : 'Cr\u00e9er'}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Delete modal -->
{#if deleteModalOpen}
<div class="overlay" onclick={e => { if (e.target === e.currentTarget) { deleteModalOpen = false; deletingRoomId = null; } }}>
  <div class="modal modal-sm" style="text-align:center">
    <h2>Supprimer la room ?</h2>
    <p class="mdesc">Cette action est irr&eacute;versible.</p>
    <div class="modal-footer" style="justify-content:center">
      <button class="btn-ghost" onclick={() => { deleteModalOpen = false; deletingRoomId = null; }}>Annuler</button>
      <button class="btn-danger" onclick={confirmDelete} disabled={deleteLoading}>Supprimer</button>
    </div>
  </div>
</div>
{/if}

<!-- Toast -->
{#if toastMsg}
  <div class="toast-container">
    <div class="toast toast-{toastType} toast-show">{toastMsg}</div>
  </div>
{/if}

<style>
  /* ── Layout ── */
  .rooms-main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px clamp(16px, 4vw, 48px) 80px;
  }
  .rooms-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }

  /* ── Tabs ── */
  .rooms-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px;
    width: fit-content;
  }
  .rtab {
    padding: 8px 20px;
    border-radius: calc(var(--radius-sm) - 4px);
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    background: none;
    color: var(--mid);
    transition: all 0.15s;
  }
  .rtab.active {
    background: var(--accent);
    color: #000;
  }

  /* ── Search ── */
  .rooms-search-wrap { margin-bottom: 12px; }
  .rooms-search { width: 100%; max-width: 400px; }

  /* ── Filtres ── */
  .rooms-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 24px;
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
  .filter-chip-reset { color: var(--danger, #f87171); border-color: rgba(248,113,113,0.2); }

  /* ── Grid rooms ── */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }

  /* ── Room card ── */
  .room-card {
    background: rgb(var(--c-glass) / 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 16px;
    transition: background 0.2s, border-color 0.2s;
    position: relative;
    overflow: hidden;
  }
  .room-card::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.08), transparent);
  }
  .room-card:hover {
    background: rgb(var(--c-glass) / 0.07);
    border-color: var(--border2);
  }
  .room-card-official {
    border-color: rgb(var(--accent2-rgb, 167,139,250) / 0.3);
  }
  .room-card-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px;
  }
  .room-card-emoji { font-size: 1.5rem; flex-shrink: 0; }
  .room-card-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .room-card-owner { font-size: 0.72rem; color: var(--dim); margin-top: 2px; }
  .room-badge-official {
    font-size: 0.62rem;
    font-weight: 700;
    background: rgb(var(--accent2-rgb, 167,139,250) / 0.12);
    border: 1px solid rgb(var(--accent2-rgb, 167,139,250) / 0.25);
    color: var(--accent2);
    padding: 2px 8px;
    border-radius: 20px;
  }
  .room-card-desc { font-size: 0.78rem; color: var(--mid); margin-bottom: 10px; line-height: 1.5; }
  .room-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .room-card-tag {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    background: rgb(var(--c-glass) / 0.06);
    border: 1px solid var(--border);
    color: var(--mid);
  }
  .room-card-online { color: #4ade80; background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.2); }
  .room-card-auto { color: var(--accent); background: rgb(var(--accent-rgb) / 0.08); border-color: rgb(var(--accent-rgb) / 0.2); }
  .room-card-private { color: var(--dim); }
  .room-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .room-card-actions { display: flex; gap: 6px; }
  .btn-delete-room {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid rgba(248,113,113,0.2);
    background: rgba(248,113,113,0.06);
    color: #f87171;
    padding: 6px 12px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .btn-delete-room:hover { background: rgba(248,113,113,0.12); }

  /* ── States ── */
  .pl-loading { padding: 48px 16px; text-align: center; color: var(--dim); font-size: 0.88rem; }
  .rooms-empty {
    padding: 64px 16px;
    text-align: center;
    color: var(--dim);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .rooms-empty span { font-size: 2.5rem; }
  .rooms-empty p { font-size: 0.88rem; line-height: 1.6; max-width: 300px; }

  /* ── Auth wall ── */
  .auth-wall {
    padding: 80px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .auth-wall-icon { font-size: 3rem; }
  .auth-wall h2 { font-size: 1.2rem; font-weight: 700; font-family: "Bricolage Grotesque", sans-serif; }
  .auth-wall p { font-size: 0.85rem; color: var(--mid); max-width: 340px; }

  /* ── Modale création/édition ── */
  .overlay {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    overflow-y: auto;
  }
  .modal {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    width: 100%;
    max-width: 520px;
    position: relative;
  }
  .modal-sm { max-width: 380px; }
  .modal-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    margin-bottom: 20px;
  }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .field label { font-size: 0.78rem; font-weight: 600; color: var(--mid); }
  .field input, .field textarea, .field select {
    background: rgb(var(--c-glass) / 0.04);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text);
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
  }
  .field input:focus, .field textarea:focus, .field select:focus {
    border-color: rgb(var(--accent-rgb) / 0.4);
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08);
  }
  .field select { cursor: pointer; }
  .field-row { display: flex; gap: 12px; }
  .field-hint { font-size: 0.7rem; color: var(--dim); margin-top: -8px; margin-bottom: 8px; }
  .field-error { font-size: 0.75rem; color: #f87171; }

  /* Playlist picker dans modal */
  .pl-picker { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .pl-picker-search { border: none; border-bottom: 1px solid var(--border); border-radius: 0; }
  .pl-picker-list { max-height: 200px; overflow-y: auto; }
  .pl-picker-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; cursor: pointer;
    transition: background 0.15s;
  }
  .pl-picker-item:hover { background: rgb(var(--c-glass) / 0.05); }
  .pl-picker-item.selected { background: rgb(var(--accent-rgb) / 0.05); }
  .pl-picker-item input[type="checkbox"] { accent-color: var(--accent); }
  .pl-picker-empty { padding: 16px; text-align: center; color: var(--dim); font-size: 0.82rem; }
  .pl-selected-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pl-chip {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.72rem; font-weight: 600;
    background: rgb(var(--accent-rgb) / 0.08);
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    color: var(--accent);
    padding: 4px 10px; border-radius: 20px;
  }
  .pl-chip-remove { cursor: pointer; color: var(--mid); font-size: 0.8rem; background: none; border: none; padding: 0; font-family: inherit; }
  .pl-track-count { font-size: 0.72rem; color: var(--dim); margin-top: 6px; }

  .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }
  .modal-error { font-size: 0.78rem; color: #f87171; margin-top: -12px; margin-bottom: 8px; }

  /* ── Delete modal ── */
  .delete-modal-text { font-size: 0.88rem; color: var(--mid); margin-bottom: 20px; line-height: 1.6; }

  /* ── Toast ── */
  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 0.85rem;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    white-space: nowrap;
  }
  .toast-success { border-color: rgba(74,222,128,0.3); color: #4ade80; }
  .toast-error { border-color: rgba(248,113,113,0.3); color: #f87171; }

  @media (max-width: 600px) {
    .rooms-main { padding: 20px 16px 80px; }
    .rooms-grid { grid-template-columns: 1fr; }
    .rooms-tabs { width: 100%; }
    .rtab { flex: 1; text-align: center; }
    .modal { padding: 20px 16px; }
    .field-row { flex-direction: column; }
  }
</style>
