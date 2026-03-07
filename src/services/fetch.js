'use strict';

// Fetch helper compatible with Node 16/17 (no native fetch) and Node 18+
let _fetch;

async function getFetch() {
  if (_fetch) return _fetch;
  if (typeof globalThis.fetch === 'function') {
    _fetch = globalThis.fetch;
    return _fetch;
  }
  try {
    const mod = await import('node-fetch');
    _fetch = mod.default;
    console.log('Info: utilisation de node-fetch');
  } catch {
    console.error('node-fetch introuvable — lance: npm install node-fetch');
    throw new Error('fetch indisponible');
  }
  return _fetch;
}

// Init at startup to avoid lazy-init latency on first request
getFetch().catch(() => {});

module.exports = { getFetch };
