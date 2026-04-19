import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

function getAssetName() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'linux') {
    return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'yt-dlp_macos' : 'yt-dlp_macos_legacy';
  }
  return 'yt-dlp_linux';
}

const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binDir = join(process.cwd(), 'bin');
const binPath = join(binDir, binName);

if (existsSync(binPath)) {
  console.log("[yt-dlp] already present:", binPath);
  process.exit(0);
}

const assetName = getAssetName();
console.log('[yt-dlp] fetching release info... (asset:', assetName, ')');
const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1');
if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

const [{ assets }] = await res.json();
const asset = assets.find(a => a.name === assetName);
if (!asset) throw new Error(`No release asset for ${assetName}`);

console.log("[yt-dlp] downloading", asset.browser_download_url);
const dl = await fetch(asset.browser_download_url);
if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);

mkdirSync(binDir, { recursive: true });
writeFileSync(binPath, Buffer.from(await dl.arrayBuffer()), { mode: 0o755 });
console.log("[yt-dlp] installed at", binPath);
