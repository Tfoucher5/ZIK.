# Audio Reliability — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer les skips de rounds et les silences en sortant yt-dlp du chemin critique et en remplaçant yt-search par youtube-sr.

**Architecture:** Le prefetch (lancé pendant la manche courante, 12s de budget) est la seule étape qui appelle yt-dlp. `startNextRound` consomme le résultat prefetché instantanément ; si le prefetch a raté, il bascule sur YouTube IFrame sans attente. Le premier round (pas de prefetch) garde un appel yt-dlp avec 8s de timeout puis bascule IFrame.

**Tech Stack:** Node.js ESM, Socket.io, `youtube-sr` (remplace `yt-search`), `yt-dlp` binary, YouTube IFrame API (fallback client).

---

### Task 1 : Installer youtube-sr, désinstaller yt-search

**Files:**

- Modify: `package.json`
- Modify: `src/lib/server/socket/game.js:1-18`

- [ ] **Step 1 : Installer/désinstaller**

```bash
cd C:/Users/Teamr/Desktop/ZIK
npm install youtube-sr
npm uninstall yt-search
```

Résultat attendu : `package.json` n'a plus `yt-search`, a `youtube-sr ^4.x`.

- [ ] **Step 2 : Mettre à jour les imports dans game.js**

Remplacer les lignes 3-4 de `src/lib/server/socket/game.js` :

```js
// AVANT
const yts = require("yt-search");

// APRÈS — supprimer cette ligne, remplacer par l'import ESM ci-dessous
```

Ajouter au début du fichier (après `import { execFile } from "child_process";`) :

```js
import { YouTube } from "youtube-sr";
```

- [ ] **Step 3 : Vérifier que le serveur démarre sans erreur**

```bash
npm run build 2>&1 | tail -5
```

---

### Task 2 : Réécrire ytsSearch() avec youtube-sr

**Files:**

- Modify: `src/lib/server/socket/game.js:326-330` (fonction `ytsSearch`)

- [ ] **Step 1 : Remplacer la fonction ytsSearch**

```js
// AVANT
async function ytsSearch(artist, title) {
  let r = await yts(`${artist} ${title} topic`);
  if (!r.videos?.length) r = await yts(`${artist} ${title}`);
  return r.videos?.length ? r.videos[0] : null;
}

// APRÈS
async function ytsSearch(artist, title) {
  const results = await YouTube.search(`${artist} - ${title}`, {
    type: "video",
    limit: 5,
  });
  if (!results.length) return null;
  const topic = results.find((v) => v.channel?.name?.endsWith("- Topic"));
  return topic || results[0];
}
```

- [ ] **Step 2 : Mettre à jour les deux usages du résultat (videoId et seconds)**

Dans `startNextRound` (vers ligne 440) et `prefetchNextRound` (vers ligne 371), partout où on lit `video.videoId` et `video.seconds` :

```js
// AVANT
videoId = video.videoId;
startSeconds = Math.max(
  0,
  Math.floor(
    Math.random() * Math.max(1, video.seconds - game.roundDuration - 10),
  ),
);

// APRÈS
videoId = video.id;
const durationSec = Math.round((video.duration || 0) / 1000);
startSeconds = Math.max(
  0,
  Math.floor(
    Math.random() * Math.max(1, durationSec - game.roundDuration - 10),
  ),
);
```

Il y a deux endroits à modifier : un dans `prefetchNextRound` et un dans `startNextRound`.

---

### Task 3 : Corriger prefetchNextRound — timeout 4s → 12s

**Files:**

- Modify: `src/lib/server/socket/game.js:374` (race dans `prefetchNextRound`)

- [ ] **Step 1 : Augmenter le timeout du race**

```js
// AVANT
ytAudio = await Promise.race([
  getYtAudioUrl(videoId).catch(() => null),
  new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
]);

// APRÈS
ytAudio = await Promise.race([
  getYtAudioUrl(videoId).catch(() => null),
  new Promise((resolve) => setTimeout(() => resolve(null), 12000)),
]);
```

---

### Task 4 : Corriger startNextRound — sortir yt-dlp du chemin critique

**Files:**

- Modify: `src/lib/server/socket/game.js:449-480`

L'objectif : si le prefetch a réussi → 0ms d'attente. Si le prefetch a raté → on essaie yt-dlp 8s pour le 1er round, sinon on passe directement à IFrame. Ne JAMAIS throw si `videoId` est disponible.

- [ ] **Step 1 : Remplacer le bloc yt-dlp + fallback dans startNextRound**

```js
// AVANT (lignes ~449-480)
// yt-dlp avec race de 1.5s : en prod il répond en <1s, sinon fallback preview
if (videoId && !ytAudio) {
  ytAudio = await Promise.race([
    getYtAudioUrl(videoId).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  if (ytAudio) ytdlAudioCache.set(videoId, ytAudio);
  else console.warn(`[ytdl] timeout ${videoId}, fallback preview`);
}

// Fallback preview : yt-dlp KO, on tente le cache d'abord (prefetch peut l'avoir déjà)
if (!ytAudio) {
  const pKey = previewCacheKey(track);
  const cachedPreview = ytdlAudioCache.get(pKey);
  if (cachedPreview && Date.now() - cachedPreview.fetchedAt < YTDL_TTL) {
    videoId = pKey;
    startSeconds = 0;
    ytAudio = cachedPreview;
  } else {
    const artist = track.mainArtist || track.artist;
    const previewUrl =
      track.preview_url ||
      (await getDeezerPreview(artist, track.title).catch(() => null)) ||
      (await getItunesPreview(artist, track.title).catch(() => null));
    if (previewUrl) {
      ytdlAudioCache.set(pKey, {
        url: previewUrl,
        mimeType: "audio/mpeg",
        fetchedAt: Date.now(),
      });
      videoId = pKey;
      startSeconds = 0;
      ytAudio = { url: previewUrl };
    }
  }
}

if (!ytAudio) throw new Error("No audio source");

// APRÈS — remplacer tout ce bloc par :
if (videoId && !ytAudio) {
  // Premier round : le prefetch n'a pas encore tourné, on donne 8s à yt-dlp
  // Manches suivantes : prefetch déjà fait, ce cas est rare (prefetch KO)
  // Dans les deux cas, si yt-dlp ne répond pas, l'IFrame prend le relai
  ytAudio = await Promise.race([
    getYtAudioUrl(videoId).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  if (ytAudio) ytdlAudioCache.set(videoId, ytAudio);
  else console.warn(`[ytdl] timeout ${videoId} — fallback IFrame`);
}

// ytAudio null + videoId présent → IFrame (client gère déjà ce cas)
// ytAudio null + videoId absent → on essaie les previews en dernier recours
if (!ytAudio && !videoId) {
  const pKey = previewCacheKey(track);
  const cachedPreview = ytdlAudioCache.get(pKey);
  if (cachedPreview && Date.now() - cachedPreview.fetchedAt < YTDL_TTL) {
    videoId = pKey;
    startSeconds = 0;
    ytAudio = cachedPreview;
  } else {
    const artist = track.mainArtist || track.artist;
    const previewUrl =
      track.preview_url ||
      (await getDeezerPreview(artist, track.title).catch(() => null)) ||
      (await getItunesPreview(artist, track.title).catch(() => null));
    if (previewUrl) {
      ytdlAudioCache.set(pKey, {
        url: previewUrl,
        mimeType: "audio/mpeg",
        fetchedAt: Date.now(),
      });
      videoId = pKey;
      startSeconds = 0;
      ytAudio = { url: previewUrl };
    }
  }
}

// Skip seulement si ni ytAudio ni videoId (yt-search a aussi échoué)
if (!ytAudio && !videoId) throw new Error("No audio source");
```

---

### Task 5 : Auto-update yt-dlp au démarrage du serveur

**Files:**

- Modify: `server.js`
- Modify: `scripts/ensure-ytdlp.mjs` (extraire la logique de téléchargement en fonction réutilisable)

- [ ] **Step 1 : Ajouter autoUpdateYtDlp() dans server.js**

Ajouter avant le `server.listen(...)` :

```js
import { execFile as _execFile } from "child_process";
import { promisify as _promisify } from "util";
import { join as _join } from "path";
import { writeFileSync as _writeFileSync } from "fs";

const _execAsync = _promisify(_execFile);
const _YTDLP_BIN =
  process.env.YOUTUBE_DL_PATH ||
  _join(
    process.cwd(),
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );

async function autoUpdateYtDlp() {
  try {
    const { stdout } = await _execAsync(_YTDLP_BIN, ["--version"], {
      timeout: 5000,
    });
    const currentVersion = stdout.trim();

    const res = await fetch(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    );
    const { tag_name: latestVersion } = await res.json();

    if (currentVersion === latestVersion) {
      console.log(`[yt-dlp] à jour (${currentVersion})`);
      return;
    }

    console.log(`[yt-dlp] mise à jour ${currentVersion} → ${latestVersion}`);
    const assetName =
      process.platform === "win32"
        ? "yt-dlp.exe"
        : process.arch === "arm64"
          ? "yt-dlp_linux_aarch64"
          : "yt-dlp_linux";

    const rel = await fetch(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    );
    const { assets } = await rel.json();
    const asset = assets.find((a) => a.name === assetName);
    if (!asset) return;

    const dl = await fetch(asset.browser_download_url);
    _writeFileSync(_YTDLP_BIN, Buffer.from(await dl.arrayBuffer()), {
      mode: 0o755,
    });
    console.log(`[yt-dlp] mis à jour → ${latestVersion}`);
  } catch (e) {
    console.warn("[yt-dlp] auto-update ignoré :", e.message);
  }
}

autoUpdateYtDlp();
```

---

### Task 6 : Bump version + lint + commit

**Files:**

- Modify: `package.json` (version)
- Modify: `src/routes/(site)/+page.svelte` (version affichée si présente)
- Modify: `src/routes/(site)/docs/+page.svelte` (version affichée si présente)

- [ ] **Step 1 : Bump version 2.1.0 → 2.1.0** (déjà à 2.1.0 selon package.json — vérifier)

La version dans `package.json` est déjà `2.1.0`. Vérifier si les pages affichent la version et si un bump est nécessaire.

- [ ] **Step 2 : Linter**

```bash
npm run lint
```

Corriger les erreurs éventuelles (imports inutilisés `yts`).

- [ ] **Step 3 : Build de vérification**

```bash
npm run build 2>&1 | tail -10
```

Résultat attendu : build sans erreur.

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json src/lib/server/socket/game.js server.js
git commit -m "perf: youtube-sr + fallback IFrame + auto-update yt-dlp"
```
