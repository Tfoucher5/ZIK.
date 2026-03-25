<script>
  import { onMount, getContext } from 'svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let tab          = $state('public');
  let pubSearch    = $state('');
  const filteredPublic = $derived(
    pubSearch.trim()
      ? publicRooms.filter(r =>
          r.name?.toLowerCase().includes(pubSearch.toLowerCase()) ||
          r.profiles?.username?.toLowerCase().includes(pubSearch.toLowerCase())
        )
      : publicRooms
  );
  let publicRooms  = $state([]);
  let myRooms      = $state([]);
  let userPlaylists = $state([]);

  let pubLoading  = $state(true);
  let mineLoading = $state(false);

  // Room modal
  let roomModalOpen  = $state(false);
  let editingRoomId  = $state(null);
  let editingCode    = $state(null);
  let roomName       = $state('');
  let roomEmoji      = $state('&#x1F3B5;');
  let roomDesc       = $state('');
  let roomPlaylistId = $state('');
  let roomMaxRounds  = $state(10);
  let roomDuration   = $state(30);
  let roomBreak      = $state(7);
  let roomPublic     = $state(true);
  let roomAutoStart  = $state(false);
  let roomError      = $state('');
  let roomSaving     = $state(false);

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
    const { data } = await sb.from('custom_playlists').select('id, name, emoji').eq('owner_id', user.id).order('name');
    userPlaylists = data || [];
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
    roomPlaylistId = ''; roomMaxRounds = 10; roomDuration = 30; roomBreak = 7; roomPublic = true; roomAutoStart = false;
    roomError = '';
    roomModalOpen = true;
  }

  async function openEdit(code, id) {
    if (!user) return;
    await loadPlaylists();
    editingRoomId = id; editingCode = code;
    try {
      const token = await getToken();
      const r = await fetch(`/api/rooms/${code}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const room = await r.json();
      roomName = room.name || ''; roomEmoji = room.emoji || '🎵'; roomDesc = room.description || '';
      roomPlaylistId = room.playlist_id || ''; roomMaxRounds = room.max_rounds || 10;
      roomDuration = room.round_duration || 30; roomBreak = room.break_duration || 7;
      roomPublic = room.is_public !== false;
      roomAutoStart = room.auto_start || false;
      roomError = '';
      roomModalOpen = true;
    } catch (e) { toast('Impossible de charger la room : ' + e.message, 'error'); }
  }

  async function saveRoom() {
    if (!roomName.trim()) { roomError = 'Le nom est requis.'; return; }
    roomSaving = true; roomError = '';
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expir\u00e9e, reconnecte-toi.');
      const body = {
        name: roomName, emoji: roomEmoji || '🎵', description: roomDesc,
        playlist_id: roomPlaylistId || null, is_public: roomPublic,
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
  <title>ZIK — Rooms de Blind Test | Rejoins une Partie</title>
  <meta name="description" content="Browse les rooms de blind test publiques ou crée la tienne. Rejoins des joueurs en live, configure ta playlist et lance une partie musicale en quelques secondes.">
  <link rel="canonical" href="https://www.zik-music.fr/rooms">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title" content="ZIK — Rooms de Blind Test">
  <meta property="og:description" content="Browse les rooms de blind test publiques ou crée la tienne. Rejoins des joueurs en live et lance une partie musicale en quelques secondes.">
  <meta property="og:url" content="https://www.zik-music.fr/rooms">

  <!-- Twitter Card -->
  <meta name="twitter:title" content="ZIK — Rooms de Blind Test">
  <meta name="twitter:description" content="Browse les rooms de blind test publiques ou crée la tienne. Rejoins des joueurs en live.">

  <link rel="stylesheet" href="/css/playlists.css">
  <link rel="stylesheet" href="/css/rooms.css">
</svelte:head>

<div class="pl-header">
  <div class="pl-header-inner">
    <div>
      <h1>Rooms <em>publiques</em></h1>
      <p class="pl-sub" style="display:block">Browse les rooms des joueurs ou cr&eacute;e la tienne.</p>
    </div>
    {#if user}
      <button class="btn-accent" onclick={openCreate}>+ Cr&eacute;er une room</button>
    {/if}
  </div>
</div>

<div class="pl-main">
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
    <div class="rooms-tabs">
      <button class="rtab" class:active={tab === 'public'} onclick={() => switchTab('public')}>Rooms publiques</button>
      <button class="rtab" class:active={tab === 'mine'}   onclick={() => switchTab('mine')}>Mes rooms</button>
    </div>

    {#if tab === 'public'}
      <div class="rooms-search-wrap">
        <input class="rooms-search" type="search" bind:value={pubSearch} placeholder="Rechercher une room..." />
      </div>
      {#if pubLoading}
        <div class="pl-loading">Chargement...</div>
      {:else if !publicRooms.length}
        <div class="rooms-empty"><span>&#x1F30E;</span><p>Aucune room publique pour l&apos;instant.<br>Sois le premier &agrave; en cr&eacute;er une !</p></div>
      {:else}
        <div class="rooms-grid">
          {#each filteredPublic as r (r.id)}
            <div class="room-card">
              <div class="room-card-head">
                <span class="room-card-emoji">{r.emoji}</span>
                <div>
                  <div class="room-card-name">{r.name}</div>
                  {#if r.profiles?.username}<div class="room-card-owner">par {r.profiles.username}</div>{/if}
                </div>
              </div>
              {#if r.description}<p class="room-card-desc">{r.description}</p>{/if}
              <div class="room-card-meta">
                <span class="room-card-tag">{r.max_rounds} manches</span>
                <span class="room-card-tag">{r.round_duration}s/manche</span>
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
      <label for="playlist">Playlist</label>
      <select bind:value={roomPlaylistId} class="room-select">
        <option value="">Choisir une playlist...</option>
        {#each userPlaylists as pl (pl.id)}
          <option value={pl.id}>{pl.emoji} {pl.name}</option>
        {/each}
      </select>
      <p style="font-size:.75rem;color:var(--dim);margin-top:4px">Au moins 3 titres requis. <a href="/playlists" style="color:var(--accent)">G&eacute;rer mes playlists</a></p>
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
