import { USER_STORE_DEFAULTS, useUserStore } from '../userStore';

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
          tokensEarned: 0,
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
          tokensEarned: 0,
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
          tokensEarned: 0,
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
          tokensEarned: 0,
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
  });
});
