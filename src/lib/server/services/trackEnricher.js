import { getFetch } from "./fetch.js";
import { parseFeaturing } from "./playlist.js";

const MB_USER_AGENT = "ZIK-BlindTest/1.0 (zik-music.fr)";
const MB_DELAY_MS = 1100;

// ─── Patterns de bruit à supprimer du titre ───────────────────────────────────

const NOISE_RES = [
  /\s*[([]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+[^)\]]+)?[)\]]\s*/gi,
  /\s*-\s*(?:\d{4}\s+)?remaster(?:ed)?\s*$/gi,
  /\s*[([]\s*live(?:\s+[^)\]]+)?[)\]]\s*/gi,
  /\s*[([]\s*(?:radio|single|album)\s+edit[)\]]\s*/gi,
  /\s*[([]\s*(?:acoustic|instrumental|extended|demo|karaoke)(?:\s+[^)\]]*)?[)\]]\s*/gi,
  /\s*[([]\s*official\s+(?:video|audio|music\s+video)[)\]]\s*/gi,
  /\s*[([]\s*(?:original|club)\s+mix[)\]]\s*/gi,
  /\s*[([]\s*deluxe(?:\s+[^)\]]+)?[)\]]\s*/gi,
  /\s*[([]\s*\d{4}\s*[)\]]\s*/g,
  /\s*[([]\s*[)\]]\s*/g,
];

const FEAT_IN_TITLE_RE =
  /\s*[([]\s*(?:feat\.?|ft\.?|featuring|with|avec)\s+([^)\]]+)[)\]]\s*/i;

// ─── Parse un titre brut → titre propre + feats extraits ─────────────────────

export function parseTitle(rawTitle) {
  if (!rawTitle) return { title: "", feats: [] };
  let title = rawTitle;
  const feats = [];

  const featMatch = title.match(FEAT_IN_TITLE_RE);
  if (featMatch) {
    featMatch[1]
      .split(/\s*[,&]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((f) => feats.push(f));
    title = title.replace(FEAT_IN_TITLE_RE, "");
  }

  for (const re of NOISE_RES) {
    title = title.replace(re, " ");
  }
  title = title.replace(/\s+/g, " ").trim();
  return { title, feats };
}

// ─── MusicBrainz ─────────────────────────────────────────────────────────────

let _lastMbRequest = 0;

async function mbDelay() {
  const elapsed = Date.now() - _lastMbRequest;
  if (elapsed < MB_DELAY_MS)
    await new Promise((r) => setTimeout(r, MB_DELAY_MS - elapsed));
  _lastMbRequest = Date.now();
}

export async function musicBrainzLookup(artist, title) {
  if (!artist || !title) return null;
  await mbDelay();
  const fetchFn = await getFetch();
  const q = `artist:"${artist.replace(/"/g, "")}" recording:"${title.replace(/"/g, "")}"`;
  try {
    const res = await fetchFn(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&limit=5&fmt=json`,
      {
        headers: { "User-Agent": MB_USER_AGENT },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const best = (data.recordings || []).find((r) => (r.score || 0) >= 85);
    if (!best) return null;

    const credits = best["artist-credit"] || [];
    const artistNames = credits
      .filter((c) => c.artist)
      .map((c) => c.artist.name);
    const { title: mbTitle } = parseTitle(best.title || "");

    return {
      title: mbTitle || best.title || null,
      mainArtist: artistNames[0] || null,
      feats: artistNames.slice(1),
      year: best["first-release-date"]
        ? parseInt(best["first-release-date"].slice(0, 4))
        : null,
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
  const q = `artist:"${artist.replace(/"/g, "")}" track:"${title.replace(/"/g, "")}"`;
  try {
    const res = await fetchFn(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`,
      {
        headers: { "User-Agent": "ZIK-BlindTest/1.0" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const track = data.data?.[0];
    if (!track) return null;
    return {
      coverUrl:
        track.album?.cover_xl ||
        track.album?.cover_big ||
        track.album?.cover_medium ||
        null,
      previewUrl: track.preview || null,
    };
  } catch {
    return null;
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

export async function enrichTrack(track) {
  const rawArtist = track.custom_artist || track.artist || "";
  const rawTitle = track.custom_title || track.title || "";

  // Step 1: string parse
  const { title: parsedTitle, feats: titleFeats } = parseTitle(rawTitle);
  const { main: parsedMain, feats: artistFeats } = parseFeaturing(rawArtist);

  // Merge feats des deux sources, sans doublons
  const mergedFeats = [...new Set([...artistFeats, ...titleFeats])];

  // Step 2: MusicBrainz
  const mb = await musicBrainzLookup(
    parsedMain || rawArtist,
    parsedTitle || rawTitle,
  );

  // Step 3: Deezer (sur les données les plus propres disponibles)
  const lookupArtist = mb?.mainArtist || parsedMain || rawArtist;
  const lookupTitle = mb?.title || parsedTitle || rawTitle;
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
  const currentFeats = Array.isArray(track.custom_feats)
    ? track.custom_feats
    : [];
  if (
    finalFeats.length > 0 &&
    JSON.stringify([...finalFeats].sort()) !==
      JSON.stringify([...currentFeats].sort())
  ) {
    updates.custom_feats = finalFeats;
    const added = finalFeats.filter((f) => !currentFeats.includes(f));
    changes.push(
      added.length
        ? `feat ajouté: ${added.join(", ")}`
        : `feats: [${finalFeats.join(", ")}]`,
    );
  }

  // Cover (seulement si absente)
  if (dz?.coverUrl && !track.cover_url) {
    updates.cover_url = dz.coverUrl;
    changes.push("cover ajoutée");
  }

  // Preview (seulement si absent)
  if (dz?.previewUrl && !track.preview_url) {
    updates.preview_url = dz.previewUrl;
    changes.push("preview ajouté");
  }

  return { updates, changes };
}
