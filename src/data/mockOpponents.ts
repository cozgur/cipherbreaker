/**
 * Twenty mock opponents used by Matchmaking + Match headers. The pool
 * was 10 in Phase 1B; iOS walkthrough during Phase 6 caught the "playing
 * the same opponents repeatedly" feel, so Phase 7A.1 doubled it. Phase
 * 2's real matchmaking will replace `pickRandomOpponent` with a server
 * call — the `MockOpponent` shape matches the Phase 2 `Opponent` domain
 * type so row components and MatchScreen don't need changes. Naming
 * patterns + level range + flag set follow SPEC §6 (3–47, twenty
 * countries).
 */

export interface MockOpponent {
  readonly id: string;
  readonly username: string;
  readonly level: number;
  readonly flag?: string;
  readonly isOnline: boolean;
}

export const mockOpponents: readonly MockOpponent[] = [
  { id: 'opp-1', username: 'shadowHunter47', level: 23, flag: '🇩🇪', isOnline: true },
  { id: 'opp-2', username: 'cipher_queen', level: 18, flag: '🇬🇧', isOnline: true },
  { id: 'opp-3', username: 'noir_kai', level: 31, flag: '🇯🇵', isOnline: true },
  { id: 'opp-4', username: 'quicksilver', level: 9, flag: '🇺🇸', isOnline: true },
  { id: 'opp-5', username: 'zeroHex', level: 14, flag: '🇹🇷', isOnline: false },
  { id: 'opp-6', username: 'midnight_ace', level: 27, flag: '🇫🇷', isOnline: true },
  { id: 'opp-7', username: 'lockpick_lia', level: 6, flag: '🇳🇱', isOnline: true },
  { id: 'opp-8', username: 'vortex_io', level: 42, flag: '🇰🇷', isOnline: true },
  { id: 'opp-9', username: 'ghost_byte', level: 11, flag: '🇸🇪', isOnline: true },
  { id: 'opp-10', username: 'radix9', level: 20, flag: '🇨🇦', isOnline: true },
  { id: 'opp-11', username: 'dragonByte42', level: 27, flag: '🇧🇷', isOnline: true },
  { id: 'opp-12', username: 'mike_42', level: 8, flag: '🇲🇽', isOnline: true },
  { id: 'opp-13', username: 'swiftFox', level: 19, flag: '🇮🇹', isOnline: true },
  { id: 'opp-14', username: 'pixelHunt7', level: 14, flag: '🇪🇸', isOnline: false },
  { id: 'opp-15', username: 'raj.k', level: 36, flag: '🇮🇳', isOnline: true },
  { id: 'opp-16', username: 'crypto_omar', level: 22, flag: '🇪🇬', isOnline: true },
  { id: 'opp-17', username: 'xX_phoenix_Xx', level: 33, flag: '🇷🇺', isOnline: true },
  { id: 'opp-18', username: 'mason_legend', level: 41, flag: '🇵🇱', isOnline: true },
  { id: 'opp-19', username: 'zen_arrow', level: 16, flag: '🇦🇷', isOnline: false },
  { id: 'opp-20', username: 'byteRaider', level: 5, flag: '🇦🇺', isOnline: true },
];

/**
 * Deterministic pick when a seed is passed (useful in tests); random
 * otherwise. Keeping the RNG caller-controlled means MatchmakingScreen
 * can rely on "random feel" in prod and reproducible reveals in CI.
 */
export function pickRandomOpponent(seed?: number): MockOpponent {
  const onlinePool = mockOpponents.filter((o) => o.isOnline);
  const pool = onlinePool.length > 0 ? onlinePool : mockOpponents;
  const randomIndex = seed != null ? seed % pool.length : Math.floor(Math.random() * pool.length);
  const picked = pool[randomIndex];
  // `noUncheckedIndexedAccess` — guaranteed non-empty by the fallback above.
  if (picked == null) {
    throw new Error('pickRandomOpponent: mockOpponents is empty');
  }
  return picked;
}

export function findOpponent(id: string): MockOpponent | undefined {
  return mockOpponents.find((opponent) => opponent.id === id);
}
