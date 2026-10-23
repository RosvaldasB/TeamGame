// Future media mappings. Keep null for text-only announcements.
// Private assets must later use authenticated URLs, never a public asset manifest.
export const MEDIA_EVENTS = {
  roleAssigned: { media: null, audience: 'player' },
  catProtection: { media: null, audience: 'public', release: 'gm' },
  eliminated: { media: null, audience: 'public', release: 'gm' },
  burnoutConverted: { media: null, audience: 'converted-player-and-gm' },
  demonsSick: { media: null, audience: 'demons-and-gm' },
  gameFinished: { media: null, audience: 'public', release: 'gm' }
};
