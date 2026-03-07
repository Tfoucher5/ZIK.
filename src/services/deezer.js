'use strict';

const { getFetch } = require('./fetch');

const DEEZER_HEADERS = { 'User-Agent': 'ZIK-BlindTest/1.0' };

async function fetchDeezerPlaylist(playlistId) {
  const fetchFn = await getFetch();

  // First page
  const res = await fetchFn(`https://api.deezer.com/playlist/${playlistId}?limit=100`, {
    headers: DEEZER_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Deezer: ${data.error.message || JSON.stringify(data.error)}`);
  if (!data.tracks?.data?.length) throw new Error('Playlist vide ou privee');

  let allTracks = [...data.tracks.data];
  const total   = data.tracks.total || allTracks.length;

  // Paginate up to 1000 tracks
  while (allTracks.length < Math.min(total, 1000)) {
    const index = allTracks.length;
    const nextR = await fetchFn(
      `https://api.deezer.com/playlist/${playlistId}/tracks?index=${index}&limit=100`,
      { headers: DEEZER_HEADERS, signal: AbortSignal.timeout(10000) }
    );
    if (!nextR.ok) break;
    const nextData = await nextR.json();
    if (nextData.error || !nextData.data?.length) break;
    allTracks = allTracks.concat(nextData.data);
  }

  data.tracks.data = allTracks;
  return data;
}

module.exports = { fetchDeezerPlaylist };
