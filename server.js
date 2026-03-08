import 'dotenv/config';
import { createServer } from 'http';
import { Server }       from 'socket.io';

// SvelteKit production handler (built by `npm run build`)
const { handler } = await import('./build/handler.js');

import { register }             from './src/lib/server/socket/game.js';
import { preloadAllPlaylists }  from './src/lib/server/services/playlist.js';

const server = createServer(handler);

const io = new Server(server, {
  transports:        ['websocket', 'polling'],
  perMessageDeflate: { threshold: 1024 },
  httpCompression:   { threshold: 1024 },
});

register(io);
preloadAllPlaylists();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ZIK en ligne -> http://localhost:${PORT}`));
