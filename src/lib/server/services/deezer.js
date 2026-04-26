import { getFetch } from "./fetch.js";

const DEEZER_HEADERS = { "User-Agent": "ZIK-BlindTest/1.0" };

export function parseExpFromUrl(url) {
  const m = url?.match(/hdnea=exp=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function fetchDeezerTrackPreview(trackId) {
  const fetchFn = await getFetch();
  try {
    const res = await fetchFn(`https://api.deezer.com/track/${trackId}`, {
      headers: DEEZER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.preview) return null;
    return data.preview;
  } catch {
    return null;
  }
}

export async function iTunesPreviewSearch(artist, title) {
  if (!artist || !title) return null;
  const fetchFn = await getFetch();
  try {
    const res = await fetchFn(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&entity=musicTrack&limit=5`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const track = (data.results || []).find((r) => r.previewUrl);
    return track?.previewUrl || null;
  } catch {
    return null;
  }
}

export async function fetchDeezerPlaylist(playlistId) {
  const fetchFn = await getFetch();

  const res = await fetchFn(
    `https://api.deezer.com/playlist/${playlistId}?limit=100`,
    {
      headers: DEEZER_HEADERS,
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error)
    throw new Error(
      `Deezer: ${data.error.message || JSON.stringify(data.error)}`,
    );
  if (!data.tracks?.data?.length) throw new Error("Playlist vide ou privee");

  let allTracks = [...data.tracks.data];
  const total = data.tracks.total || allTracks.length;

  while (allTracks.length < Math.min(total, 1000)) {
    const index = allTracks.length;
    const nextR = await fetchFn(
      `https://api.deezer.com/playlist/${playlistId}/tracks?index=${index}&limit=100`,
      { headers: DEEZER_HEADERS, signal: AbortSignal.timeout(10000) },
    );
    if (!nextR.ok) break;
    const nextData = await nextR.json();
    if (nextData.error || !nextData.data?.length) break;
    allTracks = allTracks.concat(nextData.data);
  }

  data.tracks.data = allTracks;
  return data;
}
