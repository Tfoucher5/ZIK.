// Configuration des rooms ZIK officielles
// playlist_ids : liste ordonnee, le serveur essaie chacun jusqu'a en trouver un valide

const ROOMS = {
  'hiphop': {
    id: 'hiphop',
    name: 'Hip-Hop / Rap FR',
    emoji: '🎤',
    description: 'Classiques et hits du rap francais',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b22, #d9770622)',
    playlist_ids: ['3272614282'],
    maxRounds: 10,
  },
  'electro': {
    id: 'electro',
    name: 'Electro / Dance',
    emoji: '🎧',
    description: 'House, techno, dance — fais vibrer les basses',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d422, #6366f122)',
    playlist_ids: ['1902101402'],
    maxRounds: 10,
  },
  'pop': {
    id: 'pop',
    name: 'Pop Internationale',
    emoji: '🌍',
    description: 'Les hits pop qui ont cartonne partout',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec489922, #f4365622)',
    playlist_ids: ['1565553361'],
    maxRounds: 10,
  },
  'annees90': {
    id: 'annees90',
    name: 'Annees 80 / 90 / 2000',
    emoji: '📼',
    description: 'La nostalgie en mode blind test',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #a78bfa22, #ec489922)',
    playlist_ids: ['1682663671'],
    maxRounds: 10,
  },
  'rock': {
    id: 'rock',
    name: 'Rock / Metal',
    emoji: '🤘',
    description: 'Des riffs, des solos, du volume',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef444422, #dc262622)',
    playlist_ids: ['8322150382'],
    maxRounds: 10,
  },
  'films': {
    id: 'films',
    name: 'Films & Series',
    emoji: '🎬',
    description: 'Les BO qui ont marque le cinema',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #fbbf2422, #f5973422)',
    playlist_ids: ['9435487222'],
    maxRounds: 10,
  },
};

export default ROOMS;
