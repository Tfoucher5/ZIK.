import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import { execFile as _execFile } from "child_process";
import { promisify as _promisify } from "util";
import { join as _join } from "path";
import { writeFileSync as _writeFileSync } from "fs";

// SvelteKit production handler (built by `npm run build`)
const { handler } = await import("./build/handler.js");

import { register } from "./src/lib/server/socket/game.js";
import { registerSalon } from "./src/lib/server/socket/salon.js";
import { preloadAllPlaylists } from "./src/lib/server/services/playlist.js";

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
    const { tag_name: latestVersion, assets } = await res.json();
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
    const asset = assets.find((a) => a.name === assetName);
    if (!asset) {
      console.warn("[yt-dlp] asset introuvable pour cette plateforme");
      return;
    }
    const dl = await fetch(asset.browser_download_url);
    _writeFileSync(_YTDLP_BIN, Buffer.from(await dl.arrayBuffer()), {
      mode: 0o755,
    });
    console.log(`[yt-dlp] mis à jour → ${latestVersion}`);
  } catch (e) {
    console.warn("[yt-dlp] auto-update ignoré :", e.message);
  }
}

const server = createServer(handler);

const io = new Server(server, {
  transports: ["websocket", "polling"],
  perMessageDeflate: { threshold: 1024 },
  httpCompression: { threshold: 1024 },
});

globalThis.__zik_io = io;
register(io);
registerSalon(io);
preloadAllPlaylists();
autoUpdateYtDlp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`ZIK en ligne -> http://localhost:${PORT}`),
);
