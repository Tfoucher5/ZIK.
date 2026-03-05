// ─── Configuration des rooms ZIK ─────────────────────────────────────────────
// playlist_ids : liste ordonnée, le serveur essaie chacun jusqu'à en trouver un valide

const ROOMS = {
  'hiphop': {
    id: 'hiphop',
    name: 'Hip-Hop / Rap FR',
    emoji: '🎤',
    description: 'Classiques et hits du rap français',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b22, #d9770622)',
    playlist_ids: [
      '3272614282',  // Rap FR 100% (SDM, Damso, Ninho, PNL...)
    ],
    maxRounds: 10,
  },
  'electro': {
    id: 'electro',
    name: 'Électro / Dance',
    emoji: '🎧',
    description: 'House, techno, dance — fais vibrer les basses',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d422, #6366f122)',
    playlist_ids: [
      '1902101402',  // Electronic Hits (Deezer editor)
    ],
    maxRounds: 10,
  },
  'pop': {
    id: 'pop',
    name: 'Pop Internationale',
    emoji: '🌍',
    description: 'Les hits pop qui ont cartonné partout',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec489922, #f4365622)',
    playlist_ids: [
      '1565553361',  // Hits Cultes Pop Rock (The Doors → Coldplay)
    ],
    maxRounds: 10,
  },
  'annees90': {
    id: 'annees90',
    name: 'Années 80 / 90 / 2000',
    emoji: '📼',
    description: 'La nostalgie en mode blind test',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #a78bfa22, #ec489922)',
    playlist_ids: [
      '1682663671',  // Soirée 90 (Deezer Editeurs France)
    ],
    maxRounds: 10,
  },
  'rock': {
    id: 'rock',
    name: 'Rock / Metal',
    emoji: '🤘',
    description: 'Des riffs, des solos, du volume',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef444422, #dc262622)',
    playlist_ids: [
      '8322150382',  // Top hits rock classique
    ],
    maxRounds: 10,
  },
  'films': {
    id: 'films',
    name: 'Films & Séries',
    emoji: '🎬',
    description: 'Les BO qui ont marqué le cinéma',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #fbbf2422, #f5973422)',
    playlist_ids: [
      '9435487222',  // Chansons films, séries TV, animé, jeux
    ],
    maxRounds: 10,
  },
};

module.exports = ROOMS;
