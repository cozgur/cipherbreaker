/**
 * Ten mock opponents used by Matchmaking + Match headers. Phase 2's
 * real matchmaking will replace `pickRandomOpponent` with a server
 * call — the `MockOpponent` shape matches the Phase 2 `Opponent`
 * domain type so row components and MatchScreen don't need changes.
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
