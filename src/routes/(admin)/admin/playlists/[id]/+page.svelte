<script>
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { getContext } from 'svelte';

  let { data, form } = $props();
  const adminCtx = getContext('adminToken');
  const token = $derived(adminCtx?.token ?? '');

  const playlist = $derived(data.playlist);
  const tracks   = $derived(data.tracks);

  let deletePlaylistModal = $state(false);
  let editMetaModal = $state(null); // track object

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
  }
</script>

<div class="pl-detail">
  <a href="/admin/playlists" class="back">← BACK_TO_LIST</a>

  <div class="pl-header">
    <div class="pl-title">{playlist.emoji} {playlist.name}</div>
    <div class="pl-meta">
      <span class="meta-item">OWNER: <strong>{playlist.profiles?.username ?? '—'}</strong></span>
      <span class="meta-item">TRACKS: <strong>{playlist.track_count}</strong></span>
      <span class="meta-item">CREATED: <strong>{fmt(playlist.created_at)}</strong></span>
      <span class="meta-item">UPDATED: <strong>{fmt(playlist.updated_at)}</strong></span>
      {#if playlist.is_official}<span class="badge-official">★ OFFICIAL</span>{/if}
      {#if !playlist.is_public}<span class="badge-private">🔒 PRIVATE</span>{/if}
    </div>
  </div>

  {#if form && !form.success}
    <div class="alert-err">[ERROR] {form.error ?? 'Action échouée'}</div>
  {/if}
  {#if form?.success}
    <div class="alert-ok">[OK] Action appliquée.</div>
  {/if}

  <div class="section-title">// TRACKS ({tracks.length})</div>

  {#if tracks.length === 0}
    <div class="empty">Aucune track.</div>
  {:else}
    <div class="table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th>POS</th>
            <th>ARTIST</th>
            <th>TITLE</th>
            <th>SOURCE</th>
            <th>PREVIEW</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each tracks as t, i (t.id)}
            <tr>
              <td class="td-pos">{t.position}</td>
              <td class="td-artist">
                {t.custom_artist || t.artist}
                {#if t.custom_artist}<span class="custom-badge" title="Nom custom">✎</span>{/if}
              </td>
              <td>
                {t.custom_title || t.title}
                {#if t.custom_title}<span class="custom-badge" title="Titre custom">✎</span>{/if}
                {#if t.custom_feats?.length}<span class="feat-badge">feat: {t.custom_feats.join(', ')}</span>{/if}
              </td>
              <td class="td-dim">{t.source}</td>
              <td class="td-dim">
                {#if t.preview_url}
                  <a href={t.preview_url} target="_blank" rel="noreferrer" class="link-preview">▶ play</a>
                {:else}
                  —
                {/if}
              </td>
              <td class="td-actions">
                <!-- Réordonner ▲ -->
                <form method="POST" action="?/reorderTrack" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <input type="hidden" name="direction" value="up">
                  <button class="btn-order" disabled={i === 0}>▲</button>
                </form>
                <!-- Réordonner ▼ -->
                <form method="POST" action="?/reorderTrack" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <input type="hidden" name="direction" value="down">
                  <button class="btn-order" disabled={i === tracks.length - 1}>▼</button>
                </form>
                <!-- Éditer meta -->
                <button class="btn-meta" onclick={() => editMetaModal = { ...t }}>✎</button>
                <!-- Supprimer -->
                <form method="POST" action="?/deleteTrack" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
                  <input type="hidden" name="_token" value={token}>
                  <input type="hidden" name="track_id" value={t.id}>
                  <button class="btn-del">✕</button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="danger-zone">
    <div class="section-title">// DANGER_ZONE</div>
    <button class="btn-delete-pl" onclick={() => deletePlaylistModal = true}>
      SUPPRIMER LA PLAYLIST
    </button>
  </div>
</div>

<!-- Modal edit track meta -->
{#if editMetaModal}
  <div class="modal-overlay" onclick={() => editMetaModal = null} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// EDIT_TRACK_META</div>
      <p class="modal-sub">{editMetaModal.artist} — {editMetaModal.title}</p>
      <form method="POST" action="?/editTrackMeta" use:enhance={() => async ({ update }) => { await update({ reset: false }); editMetaModal = null; }}>
        <input type="hidden" name="_token" value={token}>
        <input type="hidden" name="track_id" value={editMetaModal.id}>
        <label class="field-label">ARTISTE CUSTOM (laisser vide = original)
          <input class="field-input" type="text" name="custom_artist" value={editMetaModal.custom_artist ?? ''} placeholder={editMetaModal.artist}>
        </label>
        <label class="field-label">TITRE CUSTOM (laisser vide = original)
          <input class="field-input" type="text" name="custom_title" value={editMetaModal.custom_title ?? ''} placeholder={editMetaModal.title}>
        </label>
        <label class="field-label">FEATURINGS / NOMS ALTERNATIFS (séparés par des virgules)
          <input class="field-input" type="text" name="custom_feats" value={editMetaModal.custom_feats?.join(', ') ?? ''} placeholder="ex: feat. Nekfeu, film: Titanic">
        </label>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={() => editMetaModal = null}>CANCEL</button>
          <button type="submit" class="btn-confirm">SAVE</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal delete playlist -->
{#if deletePlaylistModal}
  <div class="modal-overlay" onclick={() => deletePlaylistModal = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-title">// DELETE_PLAYLIST</div>
      <p class="modal-warn">
        Supprimer définitivement <strong>{playlist.emoji} {playlist.name}</strong> et ses {playlist.track_count} tracks ?
      </p>
      <form method="POST" action="?/deletePlaylist" use:enhance>
        <input type="hidden" name="_token" value={token}>
        <div class="modal-btns">
          <button type="button" class="btn-cancel" onclick={() => deletePlaylistModal = false}>CANCEL</button>
          <button type="submit" class="btn-confirm btn-red">SUPPRIMER</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
.pl-detail { display: flex; flex-direction: column; gap: 24px; }

.back {
  font-size: 0.72rem;
  color: rgba(0,255,65,0.4);
  letter-spacing: 0.05em;
  transition: color 0.1s;
  width: fit-content;
}
.back:hover { color: #00ff41; }

.pl-header { display: flex; flex-direction: column; gap: 10px; }
.pl-title { font-size: 1.3rem; font-weight: 700; letter-spacing: 0.05em; }
.pl-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.meta-item { font-size: 0.72rem; color: rgba(0,255,65,0.4); }
.meta-item strong { color: rgba(0,255,65,0.8); }
.badge-official {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #ffb300;
  background: rgba(255,179,0,0.1);
  border: 1px solid rgba(255,179,0,0.3);
  border-radius: 3px;
  padding: 2px 8px;
}
.badge-private {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  background: rgba(0,255,65,0.05);
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  padding: 2px 8px;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(0,255,65,0.5);
}

.empty { font-size: 0.8rem; color: rgba(0,255,65,0.3); }

.table-wrap { overflow-x: auto; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.adm-table th {
  text-align: left;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(0,255,65,0.4);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.15);
}
.adm-table td {
  padding: 9px 12px;
  border-bottom: 1px solid rgba(0,255,65,0.06);
  color: rgba(0,255,65,0.8);
  vertical-align: middle;
}
.adm-table tr:hover td { background: rgba(0,255,65,0.03); }

.td-pos { color: rgba(0,255,65,0.35); font-size: 0.72rem; width: 48px; }
.td-artist { font-weight: 600; }
.td-dim { color: rgba(0,255,65,0.4); font-size: 0.75rem; }
.td-actions { display: flex; gap: 4px; align-items: center; }

.link-preview { color: rgba(0,255,65,0.5); font-size: 0.72rem; transition: color 0.1s; }
.link-preview:hover { color: #00ff41; }

.btn-order {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.15);
  border-radius: 3px;
  color: rgba(0,255,65,0.4);
  font-size: 0.7rem;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}
.btn-order:hover:not(:disabled) { color: #00ff41; border-color: rgba(0,255,65,0.4); }
.btn-order:disabled { opacity: 0.15; cursor: not-allowed; }

.custom-badge { font-size: 0.65rem; color: #ffb300; margin-left: 4px; opacity: 0.7; }
.feat-badge { font-size: 0.65rem; color: rgba(0,255,65,0.4); background: rgba(0,255,65,0.06); border: 1px solid rgba(0,255,65,0.12); border-radius: 2px; padding: 1px 5px; margin-left: 6px; }

.btn-meta {
  background: transparent;
  border: 1px solid rgba(255,179,0,0.2);
  border-radius: 3px;
  color: rgba(255,179,0,0.5);
  font-size: 0.75rem;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}
.btn-meta:hover { color: #ffb300; border-color: rgba(255,179,0,0.5); }

.modal-sub { font-size: 0.75rem; color: rgba(0,255,65,0.4); }
.field-label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: rgba(0,255,65,0.5);
}
.field-input {
  background: rgba(0,255,65,0.04);
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 3px;
  color: #00ff41;
  font-family: inherit;
  font-size: 0.8rem;
  padding: 7px 10px;
  outline: none;
}
.field-input:focus { border-color: rgba(0,255,65,0.5); }
.field-input::placeholder { color: rgba(0,255,65,0.2); }

.btn-del {
  background: transparent;
  border: 1px solid rgba(255,68,68,0.2);
  border-radius: 3px;
  color: rgba(255,68,68,0.5);
  font-size: 0.72rem;
  padding: 2px 7px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}
.btn-del:hover { color: #ff4444; border-color: rgba(255,68,68,0.5); }

.alert-err { color: #ff4444; font-size: 0.82rem; }
.alert-ok { color: #00ff41; font-size: 0.82rem; }

.danger-zone { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,68,68,0.15); }
.btn-delete-pl {
  background: transparent;
  border: 1px solid rgba(255,68,68,0.3);
  border-radius: 4px;
  color: rgba(255,68,68,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 9px 20px;
  cursor: pointer;
  transition: all 0.15s;
  width: fit-content;
}
.btn-delete-pl:hover { background: rgba(255,68,68,0.08); color: #ff4444; border-color: rgba(255,68,68,0.6); }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #0d0d14;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 6px;
  padding: 28px;
  width: 400px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-title { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.12em; color: #00ff41; }
.modal-warn { font-size: 0.82rem; color: rgba(0,255,65,0.7); }
.modal-warn strong { color: #ffb300; }

.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.btn-cancel, .btn-confirm {
  background: transparent;
  border: 1px solid rgba(0,255,65,0.3);
  border-radius: 3px;
  color: rgba(0,255,65,0.6);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 7px 16px;
  cursor: pointer;
  transition: all 0.1s;
}
.btn-cancel:hover { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm { border-color: rgba(0,255,65,0.5); color: #00ff41; }
.btn-confirm:hover { background: rgba(0,255,65,0.08); }
.btn-confirm.btn-red { border-color: rgba(255,68,68,0.4); color: #ff4444; }
.btn-confirm.btn-red:hover { background: rgba(255,68,68,0.08); }
</style>
