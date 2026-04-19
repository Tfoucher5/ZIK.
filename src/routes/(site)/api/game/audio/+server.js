import { ytdlAudioCache } from "$lib/server/ytdlCache.js";

const TTL = 2 * 60 * 60 * 1000;

export async function GET({ url, request }) {
  const videoId = url.searchParams.get("v");
  if (!videoId) return new Response("Missing video ID", { status: 400 });

  const cached = ytdlAudioCache.get(videoId);
  if (!cached || Date.now() - cached.fetchedAt > TTL) {
    return new Response("Audio not cached", { status: 404 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(cached.url, {
    headers: range ? { Range: range } : {},
  });

  const headers = new Headers({
    "Content-Type": cached.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  const contentRange = upstream.headers.get("content-range");
  const contentLength = upstream.headers.get("content-length");
  if (contentRange) headers.set("Content-Range", contentRange);
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: upstream.status, headers });
}
