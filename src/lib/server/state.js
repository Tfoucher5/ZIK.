// Single source of truth for all shared runtime state.
// Modules import from here; no circular deps since this file imports nothing.

export const playlistCache = {}; // roomId -> Track[]
export const customRooms = {}; // code   -> { id, name, emoji, tracks, ... }
export const dbRooms = {}; // code   -> { name, emoji, max_rounds, ... }
export const roomGames = {}; // roomId -> { roomId, players, socketToName, ... }

// salonRooms is anchored on globalThis so that both the Vite plugin's native
// import() and SvelteKit's SSR module system share the exact same object in dev.
globalThis.__zik_salonRooms = globalThis.__zik_salonRooms ?? {};
export const salonRooms = globalThis.__zik_salonRooms; // code -> { code, hostSocketId, settings, players, game }
