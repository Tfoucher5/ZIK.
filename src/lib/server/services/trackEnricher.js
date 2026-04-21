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

// ─── Normalisation & correspondance artiste ───────────────────────────────────

function normalizeStr(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function artistMatch(original, candidate) {
  if (!original || !candidate) return false;
  const no = normalizeStr(original);
  const nc = normalizeStr(candidate);
  return no === nc || no.includes(nc) || nc.includes(no);
}

// ─── Vote majoritaire entre plusieurs sources ─────────────────────────────────
// votes = [{ value: string, weight: number }]
// Retourne la valeur dont la somme de poids est la plus élevée,
// à condition que ≥2 sources s'accordent OU qu'il n'y en ait qu'une seule.

function voteConsensus(votes) {
  const valid = votes.filter((v) => v.value);
  if (!valid.length) return null;

  const groups = {};
  for (const v of valid) {
    const norm = normalizeStr(v.value);
    if (!groups[norm]) {
      groups[norm] = {
        totalWeight: 0,
        count: 0,
        topValue: v.value,
        topWeight: 0,
      };
    }
    groups[norm].totalWeight += v.weight;
    groups[norm].count++;
    if (v.weight > groups[norm].topWeight) {
      groups[norm].topValue = v.value;
      groups[norm].topWeight = v.weight;
    }
  }

  const best = Object.values(groups).sort(
    (a, b) => b.totalWeight - a.totalWeight,
  )[0];

  if (best.count >= 2 || valid.length === 1) return best.topValue;
  return null;
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
    const best = (data.recordings || []).find((r) => (r.score || 0) >= 90);
    if (!best) return null;

    const credits = best["artist-credit"] || [];
    const artistNames = credits
      .filter((c) => c.artist)
      .map((c) => c.artist.name);
    const { title: mbTitle } = parseTitle(best.title || "");

    return {
      title: mbTitle || best.title || null,
      artist: artistNames[0] || null,
      feats: artistNames.slice(1),
      year: best["first-release-date"]
        ? parseInt(best["first-release-date"].slice(0, 4))
        : null,
      score: best.score,
      coverUrl: null,
      previewUrl: null,
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
      title: track.title || null,
      artist: track.artist?.name || null,
      feats: [],
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

// ─── iTunes Search ────────────────────────────────────────────────────────────

export async function iTunesSearch(artist, title) {
  if (!artist || !title) return null;
  const fetchFn = await getFetch();
  const q = `${artist} ${title}`;
  try {
    const res = await fetchFn(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicTrack&limit=5`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const track = (data.results || []).find((r) =>
      artistMatch(artist, r.artistName),
    );
    if (!track) return null;
    const { title: cleanTitle } = parseTitle(track.trackName || "");
    return {
      title: cleanTitle || track.trackName || null,
      artist: track.artistName || null,
      feats: [],
      coverUrl: track.artworkUrl100?.replace("100x100bb", "600x600bb") || null,
      previewUrl: track.previewUrl || null,
    };
  } catch {
    return null;
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

export async function enrichTrack(track) {
  const rawArtist = track.custom_artist || track.artist || "";
  const rawTitle = track.custom_title || track.title || "";

  // Step 1: nettoyage local
  const { title: parsedTitle, feats: titleFeats } = parseTitle(rawTitle);
  const { main: parsedMain, feats: artistFeats } = parseFeaturing(rawArtist);
  const mergedFeats = [...new Set([...artistFeats, ...titleFeats])];

  const refArtist = parsedMain || rawArtist;
  const refTitle = parsedTitle || rawTitle;

  // Step 2: requêtes parallèles (MB, Deezer, iTunes)
  const [mb, dz, itunes] = await Promise.all([
    musicBrainzLookup(refArtist, refTitle),
    deezerSearch(refArtist, refTitle),
    iTunesSearch(refArtist, refTitle),
  ]);

  // Step 3: ne garder que les sources dont l'artiste correspond à l'original
  // Poids : MB=3 (le plus autoritaire), iTunes=2, Deezer=1
  const trusted = [
    mb && artistMatch(refArtist, mb.artist) ? { ...mb, weight: 3 } : null,
    itunes && artistMatch(refArtist, itunes.artist)
      ? { ...itunes, weight: 2 }
      : null,
    dz && artistMatch(refArtist, dz.artist) ? { ...dz, weight: 1 } : null,
  ].filter(Boolean);

  // Step 4: consensus titre / artiste
  const updates = {};
  const changes = [];

  const finalTitle =
    voteConsensus(trusted.map((s) => ({ value: s.title, weight: s.weight }))) ||
    parsedTitle;
  if (finalTitle && finalTitle !== rawTitle) {
    updates.custom_title = finalTitle;
    changes.push(`titre: "${rawTitle}" → "${finalTitle}"`);
  }

  const finalArtist =
    voteConsensus(
      trusted.map((s) => ({ value: s.artist, weight: s.weight })),
    ) || parsedMain;
  if (finalArtist && finalArtist !== rawArtist) {
    updates.custom_artist = finalArtist;
    changes.push(`artiste: "${rawArtist}" → "${finalArtist}"`);
  }

  // Feats : MB en priorité (seul à les fournir vraiment), sinon parse local
  const mbTrusted = trusted.find((s) => s.feats?.length && s.weight === 3);
  const finalFeats = mbTrusted?.feats?.length ? mbTrusted.feats : mergedFeats;
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

  // Cover & preview : première source disponible (toutes sources confondues)
  const allSources = [mb, dz, itunes].filter(Boolean);
  const coverUrl = allSources.find((s) => s.coverUrl)?.coverUrl || null;
  const previewUrl = allSources.find((s) => s.previewUrl)?.previewUrl || null;

  if (coverUrl && !track.cover_url) {
    updates.cover_url = coverUrl;
    changes.push("cover ajoutée");
  }
  if (previewUrl && !track.preview_url) {
    updates.preview_url = previewUrl;
    changes.push("preview ajouté");
  }

  return { updates, changes };
}
