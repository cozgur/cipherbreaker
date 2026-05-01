import { __migrateUserStoreForTests, USER_STORE_DEFAULTS, useUserStore } from '../userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({ ...USER_STORE_DEFAULTS });
  });

  it('starts at the documented defaults', () => {
    const state = useUserStore.getState();
    expect(state.tokens).toBe(1840);
    expect(state.username).toBe('nova_code');
    expect(state.hasOnboarded).toBe(true);
  });

  it('addTokens accumulates positively', () => {
    useUserStore.getState().addTokens(500);
    expect(useUserStore.getState().tokens).toBe(1840 + 500);
  });

  it('addTokens ignores zero / negative input', () => {
    useUserStore.getState().addTokens(0);
    useUserStore.getState().addTokens(-100);
    expect(useUserStore.getState().tokens).toBe(1840);
  });

  it('subtractTokens deducts and clamps at zero', () => {
    useUserStore.setState({ tokens: 100 });
    useUserStore.getState().subtractTokens(40);
    expect(useUserStore.getState().tokens).toBe(60);
    useUserStore.getState().subtractTokens(500);
    expect(useUserStore.getState().tokens).toBe(0);
  });

  it('subtractTokens ignores zero / negative input', () => {
    useUserStore.setState({ tokens: 100 });
    useUserStore.getState().subtractTokens(0);
    useUserStore.getState().subtractTokens(-50);
    expect(useUserStore.getState().tokens).toBe(100);
  });

  it('setUsername trims and rejects empty strings', () => {
    useUserStore.getState().setUsername('  neon_rider  ');
    expect(useUserStore.getState().username).toBe('neon_rider');
    useUserStore.getState().setUsername('   ');
    expect(useUserStore.getState().username).toBe('neon_rider');
  });

  it('setHasOnboarded flips the flag without touching siblings', () => {
    const before = useUserStore.getState();
    useUserStore.getState().setHasOnboarded(false);
    const after = useUserStore.getState();
    expect(after.hasOnboarded).toBe(false);
    expect(after.tokens).toBe(before.tokens);
    expect(after.username).toBe(before.username);
  });

  it('exposes a persist API (durable)', () => {
    expect(useUserStore.persist).toBeDefined();
    expect(typeof useUserStore.persist.clearStorage).toBe('function');
  });

  describe('addXp', () => {
    it('accumulates positive amounts onto currentXP', () => {
      useUserStore.getState().addXp(30);
      expect(useUserStore.getState().currentXP).toBe(2340 + 30);
    });

    it('ignores zero / negative input', () => {
      useUserStore.getState().addXp(0);
      useUserStore.getState().addXp(-50);
      expect(useUserStore.getState().currentXP).toBe(2340);
    });
  });

  describe('recordMatchResult', () => {
    it('victory bumps gamesPlayed, raises winRate, increments streak, and updates bestStreak', () => {
      // Pin baseline so recompute is deterministic — wins=68 at 100 games,
      // currentStreak just below the best so a +1 surpasses it.
      useUserStore.setState({
        stats: {
          gamesPlayed: 100,
          winRate: 68,
          currentStreak: 10,
          bestStreak: 10,
          avgTurns: 5,
          totalTokensEarned: 0,
          recentMatches: [],
        },
      });
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'victory',
        turns: 4,
      });
      const stats = useUserStore.getState().stats;
      expect(stats.gamesPlayed).toBe(101);
      // 69 wins / 101 games = 0.683… → 68% (rounding holds the floor)
      expect(stats.winRate).toBe(68);
      expect(stats.currentStreak).toBe(11);
      expect(stats.bestStreak).toBe(11);
    });

    it('defeat bumps gamesPlayed, drops winRate, and resets the current streak', () => {
      useUserStore.setState({
        stats: {
          gamesPlayed: 100,
          winRate: 80,
          currentStreak: 7,
          bestStreak: 12,
          avgTurns: 5,
          totalTokensEarned: 0,
          recentMatches: [],
        },
      });
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'defeat',
        turns: 6,
      });
      const stats = useUserStore.getState().stats;
      expect(stats.gamesPlayed).toBe(101);
      expect(stats.winRate).toBeLessThan(80);
      expect(stats.currentStreak).toBe(0);
      expect(stats.bestStreak).toBe(12); // unchanged
    });

    it('draw bumps gamesPlayed but leaves the streak alone', () => {
      const before = useUserStore.getState().stats;
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'draw',
        turns: 5,
      });
      const stats = useUserStore.getState().stats;
      expect(stats.gamesPlayed).toBe(before.gamesPlayed + 1);
      expect(stats.currentStreak).toBe(before.currentStreak);
    });

    it('updates perMode[modeId].winRate and leaves untouched modes alone', () => {
      // Seed a small stats baseline so the modeId=1 estimated games
      // count is small enough that one win moves the rate meaningfully.
      useUserStore.setState({
        stats: {
          gamesPlayed: 7,
          winRate: 50,
          currentStreak: 0,
          bestStreak: 0,
          avgTurns: 5,
          totalTokensEarned: 0,
          recentMatches: [],
        },
        perMode: { 1: { winRate: 50 }, 2: { winRate: 64 }, 7: { winRate: 52 } },
      });
      const before = useUserStore.getState().perMode;
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'victory',
        turns: 4,
      });
      const after = useUserStore.getState().perMode;
      expect(after[1]).toBeDefined();
      expect(after[1]!.winRate).toBeGreaterThan(before[1]!.winRate);
      // Other modes unchanged.
      expect(after[2]).toEqual(before[2]);
      expect(after[7]).toEqual(before[7]);
    });

    it('seeds a perMode entry for an unknown modeId without throwing', () => {
      useUserStore.getState().recordMatchResult({
        modeId: 99,
        outcome: 'victory',
        turns: 4,
      });
      const after = useUserStore.getState().perMode;
      expect(after[99]).toBeDefined();
      expect(typeof after[99]!.winRate).toBe('number');
    });

    it('folds turns into the running avgTurns mean', () => {
      useUserStore.setState({
        stats: {
          gamesPlayed: 9,
          winRate: 50,
          currentStreak: 0,
          bestStreak: 0,
          avgTurns: 5,
          totalTokensEarned: 0,
          recentMatches: [],
        },
      });
      // (5 * 9 + 6) / 10 = 5.1
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'victory',
        turns: 6,
      });
      expect(useUserStore.getState().stats.avgTurns).toBeCloseTo(5.1, 1);
    });

    it('appends the outcome onto the rolling recentMatches window', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: [] },
      });
      useUserStore.getState().recordMatchResult({ modeId: 1, outcome: 'victory', turns: 4 });
      useUserStore.getState().recordMatchResult({ modeId: 1, outcome: 'defeat', turns: 6 });
      useUserStore.getState().recordMatchResult({ modeId: 1, outcome: 'draw', turns: 5 });
      expect(useUserStore.getState().stats.recentMatches).toEqual([
        'victory',
        'defeat',
        'draw',
      ]);
    });

    it('caps recentMatches at the ten most recent outcomes (sliding window)', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: [] },
      });
      // Record 12 matches; first two should fall off the tail.
      for (let i = 0; i < 12; i += 1) {
        useUserStore.getState().recordMatchResult({
          modeId: 1,
          outcome: i % 2 === 0 ? 'victory' : 'defeat',
          turns: 4,
        });
      }
      const recent = useUserStore.getState().stats.recentMatches;
      expect(recent).toHaveLength(10);
      // Last entry came in on i=11 (odd) → defeat.
      expect(recent[recent.length - 1]).toBe('defeat');
    });

    it('increments totalTokensEarned by tokensEarnedThisMatch when positive', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, totalTokensEarned: 1000 },
      });
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'victory',
        turns: 4,
        tokensEarnedThisMatch: 100,
      });
      expect(useUserStore.getState().stats.totalTokensEarned).toBe(1100);
    });

    it('clamps a negative tokensEarnedThisMatch to zero (no debit on the lifetime counter)', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, totalTokensEarned: 500 },
      });
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'defeat',
        turns: 6,
        tokensEarnedThisMatch: -50,
      });
      expect(useUserStore.getState().stats.totalTokensEarned).toBe(500);
    });

    it('omitted tokensEarnedThisMatch defaults to zero (legacy callers stay neutral)', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, totalTokensEarned: 200 },
      });
      useUserStore.getState().recordMatchResult({ modeId: 1, outcome: 'draw', turns: 5 });
      expect(useUserStore.getState().stats.totalTokensEarned).toBe(200);
    });
  });

  describe('migration — chained v1 → v2 → v3', () => {
    // Phase 7A.4 CP3: chained migration pattern. A v1 blob hydrates
    // through both upgrade steps to land at v3; a v2 blob takes the
    // v2 → v3 step alone; v3 is identity. Each step preserves prior
    // fields and seeds the new fields with documented defaults.

    it('v1 → v3: renames tokensEarned, seeds recentMatches, AND seeds dailyChallenge defaults', () => {
      const v1State = {
        username: 'phoenix99',
        tokens: 1234,
        level: 8,
        currentXP: 500,
        targetXP: 800,
        hasOnboarded: true,
        stats: {
          gamesPlayed: 50,
          winRate: 60,
          currentStreak: 3,
          bestStreak: 7,
          avgTurns: 5.1,
          tokensEarned: 9_999,
        },
        perMode: { 1: { winRate: 70 } },
      };
      const next = __migrateUserStoreForTests(v1State, 1);
      // v1 → v2 transformations preserved.
      expect(next.username).toBe('phoenix99');
      expect(next.tokens).toBe(1234);
      expect(next.level).toBe(8);
      expect(next.stats.totalTokensEarned).toBe(9_999);
      expect(next.stats.recentMatches).toEqual([]);
      expect(next.stats.gamesPlayed).toBe(50);
      expect(next.stats.winRate).toBe(60);
      expect(next.perMode[1]).toEqual({ winRate: 70 });
      // v2 → v3 dailyChallenge seeded with full default shape.
      // `inProgress` deliberately NOT a field of DailyChallengeState
      // — the in-progress attempt lives in `dailyChallengeStore`
      // (matchStore-pattern split, Phase 7A.4 CP4 schema cleanup).
      expect(next.dailyChallenge).toEqual({
        lastPlayedDate: null,
        currentStreak: 0,
        longestStreak: 0,
        effectiveDayOffset: 0,
        lastResult: null,
        history: [],
      });
    });

    it('v2 → v3: preserves every v2 field byte-for-byte and seeds dailyChallenge', () => {
      // Realistic v2 blob — what someone who hydrated through Phase
      // 7A.1 looks like on disk today. recentMatches has real data.
      const v2State = {
        username: 'cipher_kid',
        tokens: 2400,
        level: 14,
        currentXP: 1100,
        targetXP: 2000,
        hasOnboarded: true,
        stats: {
          gamesPlayed: 89,
          winRate: 71,
          currentStreak: 5,
          bestStreak: 13,
          avgTurns: 4.7,
          totalTokensEarned: 18_500,
          recentMatches: ['victory', 'victory', 'defeat', 'victory'],
        },
        perMode: {
          1: { winRate: 75 },
          2: { winRate: 68 },
          3: { winRate: 62 },
          4: { winRate: 60 },
          5: { winRate: 55 },
          6: { winRate: 65 },
          7: { winRate: 58 },
        },
      };
      const next = __migrateUserStoreForTests(v2State, 2);
      // Every v2 field survives.
      expect(next.username).toBe('cipher_kid');
      expect(next.tokens).toBe(2400);
      expect(next.level).toBe(14);
      expect(next.currentXP).toBe(1100);
      expect(next.targetXP).toBe(2000);
      expect(next.stats.gamesPlayed).toBe(89);
      expect(next.stats.totalTokensEarned).toBe(18_500);
      expect(next.stats.recentMatches).toEqual(['victory', 'victory', 'defeat', 'victory']);
      expect(next.perMode[3]).toEqual({ winRate: 62 });
      expect(next.perMode[7]).toEqual({ winRate: 58 });
      // dailyChallenge seeded fresh — no historical Daily data exists
      // pre-7A.4, so every v2 hydrate starts the streak from zero.
      expect(next.dailyChallenge.lastPlayedDate).toBeNull();
      expect(next.dailyChallenge.currentStreak).toBe(0);
      expect(next.dailyChallenge.longestStreak).toBe(0);
      expect(next.dailyChallenge.effectiveDayOffset).toBe(0);
      expect(next.dailyChallenge.history).toEqual([]);
      expect(next.dailyChallenge.lastResult).toBeNull();
    });

    it('v3 is idempotent — current-version state passes through unchanged', () => {
      const next = __migrateUserStoreForTests(USER_STORE_DEFAULTS, 3);
      expect(next).toBe(USER_STORE_DEFAULTS);
    });

    it('falls back to defaults for an unknown (future) version stamp', () => {
      const next = __migrateUserStoreForTests({}, 99);
      expect(next).toEqual(USER_STORE_DEFAULTS);
    });

    it('handles a v1 state with a missing `stats` key without throwing — chains to v3', () => {
      const partial = { username: 'ghost', tokens: 100 };
      const next = __migrateUserStoreForTests(partial, 1);
      expect(next.username).toBe('ghost');
      expect(next.tokens).toBe(100);
      expect(next.stats.recentMatches).toEqual([]);
      expect(next.stats.totalTokensEarned).toBe(USER_STORE_DEFAULTS.stats.totalTokensEarned);
      expect(next.dailyChallenge.history).toEqual([]);
    });

    it('the v2 → v3 step alone never touches non-dailyChallenge fields', () => {
      // Sanity guard — if a future PR accidentally re-derives stats
      // inside migrateV2ToV3 (e.g. "let us recompute winRate"), the
      // round-trip below stops being identity on the stats slice.
      const v2 = {
        ...USER_STORE_DEFAULTS,
        // Strip the v3-specific field to mimic an actual v2 blob.
      } as unknown;
      const v2WithoutDaily = { ...(v2 as object) } as Record<string, unknown>;
      delete v2WithoutDaily.dailyChallenge;
      const next = __migrateUserStoreForTests(v2WithoutDaily, 2);
      expect(next.username).toBe(USER_STORE_DEFAULTS.username);
      expect(next.stats).toEqual(USER_STORE_DEFAULTS.stats);
      expect(next.perMode).toEqual(USER_STORE_DEFAULTS.perMode);
    });
  });
});
