import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const isWin = process.platform === "win32";
const binName = isWin ? "yt-dlp.exe" : "yt-dlp";
const binDir = join(process.cwd(), "bin");
const binPath = join(binDir, binName);

if (existsSync(binPath)) {
  console.log("[yt-dlp] already present:", binPath);
  process.exit(0);
}

console.log("[yt-dlp] fetching release info...");
const res = await fetch(
  "https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1",
);
if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

const [{ assets }] = await res.json();
const asset = assets.find((a) => a.name === binName);
if (!asset) throw new Error(`No release asset for ${binName}`);

console.log("[yt-dlp] downloading", asset.browser_download_url);
const dl = await fetch(asset.browser_download_url);
if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);

mkdirSync(binDir, { recursive: true });
writeFileSync(binPath, Buffer.from(await dl.arrayBuffer()), { mode: 0o755 });
console.log("[yt-dlp] installed at", binPath);
