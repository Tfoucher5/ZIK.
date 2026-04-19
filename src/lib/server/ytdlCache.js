// Cache des URLs audio YouTube extraites via ytdl — survie au hot-reload
export const ytdlAudioCache = globalThis.__zik_ytdl_cache ?? new Map();
globalThis.__zik_ytdl_cache = ytdlAudioCache;
// entries: videoId -> { url, mimeType, fetchedAt }
// TTL 2h (les stream URLs YouTube expirent)
