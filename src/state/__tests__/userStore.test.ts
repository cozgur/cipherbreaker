import { __resetRegistryForTests, modeRegistry } from '@game/modeRegistry';
import { mode1ColorMatch } from '@game/modes/mode1ColorMatch';
import { useMatchStore } from '@state/matchStore';
import { __migrateUserStoreForTests, USER_STORE_DEFAULTS, useUserStore } from '../userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({ ...USER_STORE_DEFAULTS });
    // Phase 7A.5 Codex finding 1 — applyRewardedDouble reads
    // mode catalog via modeRegistry, so register Mode 1 for the
    // double tests. Other tests don't depend on this and the
    // registration is idempotent across the suite.
    __resetRegistryForTests();
    modeRegistry.register(mode1ColorMatch);
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

  describe('resetPlayStats — admin DEV action', () => {
    it('zeroes game stats, per-mode rates, recentMatches, and dailyChallenge', () => {
      // Pre-load some real-looking play history.
      useUserStore.setState({
        stats: {
          gamesPlayed: 50,
          winRate: 65,
          currentStreak: 4,
          bestStreak: 9,
          avgTurns: 5.2,
          totalTokensEarned: 8_400,
          recentMatches: ['victory', 'defeat', 'victory'],
        },
        perMode: {
          1: { winRate: 72 },
          2: { winRate: 60 },
          3: { winRate: 58 },
          4: { winRate: 55 },
          5: { winRate: 49 },
          6: { winRate: 61 },
          7: { winRate: 52 },
        },
        dailyChallenge: {
          ...USER_STORE_DEFAULTS.dailyChallenge,
          lastPlayedDate: '2026-05-10',
          currentStreak: 7,
          longestStreak: 12,
          effectiveDayOffset: 7,
          history: [
            { date: '2026-05-10', digits: 4, turns: 3, success: true, hintsUsed: 0 },
          ],
        },
      });

      useUserStore.getState().resetPlayStats();

      const next = useUserStore.getState();
      expect(next.stats.gamesPlayed).toBe(0);
      expect(next.stats.winRate).toBe(0);
      expect(next.stats.currentStreak).toBe(0);
      expect(next.stats.bestStreak).toBe(0);
      expect(next.stats.avgTurns).toBe(0);
      expect(next.stats.totalTokensEarned).toBe(0);
      expect(next.stats.recentMatches).toEqual([]);
      for (const id of [1, 2, 3, 4, 5, 6, 7]) {
        expect(next.perMode[id]).toEqual({ winRate: 0 });
      }
      expect(next.dailyChallenge.lastPlayedDate).toBeNull();
      expect(next.dailyChallenge.currentStreak).toBe(0);
      expect(next.dailyChallenge.longestStreak).toBe(0);
      expect(next.dailyChallenge.effectiveDayOffset).toBe(0);
      expect(next.dailyChallenge.history).toEqual([]);
    });

    it('preserves identity + economy fields (tokens, level, XP, username, hasOnboarded)', () => {
      useUserStore.setState({
        username: 'phoenix',
        tokens: 5000,
        level: 18,
        currentXP: 1500,
        targetXP: 2400,
        hasOnboarded: true,
      });

      useUserStore.getState().resetPlayStats();

      const next = useUserStore.getState();
      expect(next.username).toBe('phoenix');
      expect(next.tokens).toBe(5000);
      expect(next.level).toBe(18);
      expect(next.currentXP).toBe(1500);
      expect(next.targetXP).toBe(2400);
      expect(next.hasOnboarded).toBe(true);
    });
  });

  describe('migration — chained v1 → v2 → v3 → v4', () => {
    // Phase 7A.4 CP3 + Phase 7A.5 CP1: chained migration pattern.
    // A v1 blob hydrates through every upgrade step to land at v4;
    // a v3 blob takes the v3 → v4 step alone; v4 is identity. Each
    // step preserves prior fields and seeds the new fields with
    // documented defaults.

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
        earnedHints: 0,
        lastHintEarnedAtStreak: 0,
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

    it('v4 is idempotent — current-version state passes through unchanged', () => {
      const next = __migrateUserStoreForTests(USER_STORE_DEFAULTS, 4);
      expect(next).toBe(USER_STORE_DEFAULTS);
    });

    it('v3 → v4: preserves every v3 field and seeds the four Phase 7A.5 economy fields', () => {
      // Realistic v3 blob — a player who hydrated through Phase
      // 7A.4 fully (active streak, hint pool earned, recentMatches
      // populated). The v3 → v4 step must NOT touch any of these.
      const v3State = {
        username: 'streak_seven',
        tokens: 500,
        level: 12,
        currentXP: 2340,
        targetXP: 3200,
        hasOnboarded: true,
        stats: {
          gamesPlayed: 247,
          winRate: 68,
          currentStreak: 4,
          bestStreak: 11,
          avgTurns: 5.3,
          totalTokensEarned: 12_400,
          recentMatches: ['victory', 'victory', 'defeat'],
        },
        perMode: { 1: { winRate: 72 }, 7: { winRate: 52 } },
        dailyChallenge: {
          lastPlayedDate: '2026-05-04',
          currentStreak: 7,
          longestStreak: 7,
          effectiveDayOffset: 0,
          lastResult: null,
          history: [],
          earnedHints: 1,
          lastHintEarnedAtStreak: 7,
        },
      };
      const next = __migrateUserStoreForTests(v3State, 3);
      // Every v3 field survives byte-for-byte.
      expect(next.username).toBe('streak_seven');
      expect(next.tokens).toBe(500);
      expect(next.stats.totalTokensEarned).toBe(12_400);
      expect(next.stats.recentMatches).toEqual(['victory', 'victory', 'defeat']);
      expect(next.dailyChallenge.currentStreak).toBe(7);
      expect(next.dailyChallenge.earnedHints).toBe(1);
      expect(next.dailyChallenge.lastHintEarnedAtStreak).toBe(7);
      // Four Phase 7A.5 fields seeded — pre-7A.5 player gets fresh
      // ad-cap, fresh interstitial counter, no IAP purchase.
      expect(next.adsWatchedToday).toBe(0);
      expect(next.adsWatchedLastDate).toBeNull();
      expect(next.matchesSinceLastInterstitial).toBe(0);
      expect(next.adsRemoved).toBe(false);
    });

    it('v1 → v4: full chain hydrates through every step', () => {
      // Pre-Phase-7A.1 v1 blob with the original `tokensEarned`
      // field name. Must land at v4 with all upgrade-step fields
      // seeded, NOT fall through to defaults.
      const v1State = {
        username: 'ancient_user',
        tokens: 800,
        level: 10,
        currentXP: 1000,
        targetXP: 2000,
        hasOnboarded: true,
        stats: {
          gamesPlayed: 100,
          winRate: 55,
          currentStreak: 2,
          bestStreak: 9,
          avgTurns: 5.8,
          tokensEarned: 6_000,
        },
        perMode: { 1: { winRate: 60 } },
      };
      const next = __migrateUserStoreForTests(v1State, 1);
      // v1 → v2 step.
      expect(next.stats.totalTokensEarned).toBe(6_000);
      expect(next.stats.recentMatches).toEqual([]);
      // v2 → v3 step.
      expect(next.dailyChallenge.lastPlayedDate).toBeNull();
      expect(next.dailyChallenge.history).toEqual([]);
      // v3 → v4 step (Phase 7A.5).
      expect(next.adsWatchedToday).toBe(0);
      expect(next.adsWatchedLastDate).toBeNull();
      expect(next.matchesSinceLastInterstitial).toBe(0);
      expect(next.adsRemoved).toBe(false);
      // Identity preservation across all three steps.
      expect(next.username).toBe('ancient_user');
      expect(next.tokens).toBe(800);
    });

    it('falls back to defaults for an unknown (future) version stamp', () => {
      const next = __migrateUserStoreForTests({}, 99);
      expect(next).toEqual(USER_STORE_DEFAULTS);
    });

    it('handles a v1 state with a missing `stats` key without throwing — chains to v4', () => {
      const partial = { username: 'ghost', tokens: 100 };
      const next = __migrateUserStoreForTests(partial, 1);
      expect(next.username).toBe('ghost');
      expect(next.tokens).toBe(100);
      expect(next.stats.recentMatches).toEqual([]);
      expect(next.stats.totalTokensEarned).toBe(USER_STORE_DEFAULTS.stats.totalTokensEarned);
      expect(next.dailyChallenge.history).toEqual([]);
      expect(next.adsWatchedToday).toBe(0);
      expect(next.adsRemoved).toBe(false);
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

  describe('Phase 7A.5 CP1 — economy actions', () => {
    it('incrementMatchCounter bumps the counter by 1 each call', () => {
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
      useUserStore.getState().incrementMatchCounter();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(1);
      useUserStore.getState().incrementMatchCounter();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(2);
      useUserStore.getState().incrementMatchCounter();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
    });

    it('resetMatchCounter zeroes the counter regardless of prior value', () => {
      useUserStore.setState({ matchesSinceLastInterstitial: 7 });
      useUserStore.getState().resetMatchCounter();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    });

    it('setAdsRemoved flips the IAP flag both ways', () => {
      expect(useUserStore.getState().adsRemoved).toBe(false);
      useUserStore.getState().setAdsRemoved(true);
      expect(useUserStore.getState().adsRemoved).toBe(true);
      useUserStore.getState().setAdsRemoved(false);
      expect(useUserStore.getState().adsRemoved).toBe(false);
    });

    it('setAdsRemoved does NOT credit a token bonus (Q12 — value prop is the ad-free experience)', () => {
      const tokensBefore = useUserStore.getState().tokens;
      useUserStore.getState().setAdsRemoved(true);
      expect(useUserStore.getState().tokens).toBe(tokensBefore);
    });

    describe('applyRewardedDouble — Phase 7A.5 CP6 + Codex finding 1 fix', () => {
      let originalDate: typeof Date;

      beforeEach(() => {
        // Pin Date so the cap module's "today" string is deterministic
        // across test runs.
        originalDate = global.Date;
        const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
        function MockDate(this: Date, ...args: unknown[]) {
          if (!new.target) return new (originalDate as DateConstructor)().toString();
          if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
          // @ts-expect-error pass-through to native Date constructor
          return new (originalDate as DateConstructor)(...args);
        }
        MockDate.prototype = originalDate.prototype;
        MockDate.now = () => fixedTime;
        MockDate.parse = originalDate.parse.bind(originalDate);
        MockDate.UTC = originalDate.UTC.bind(originalDate);
        // @ts-expect-error mock Date substitution
        global.Date = MockDate;
      });

      afterEach(() => {
        global.Date = originalDate;
        useMatchStore.getState().clearMatch();
      });

      function seedCompletedWinMatch(
        matchId: string,
        outcome: 'player_won' | 'draw' = 'player_won',
        modeId = 1,
      ): void {
        useMatchStore.setState({
          matchState: {
            id: matchId,
            modeId,
            playerSecret: '1234',
            opponentSecret: '5678',
            playerGuesses: [],
            opponentGuesses: [],
            rngState: { seed: 1, callCount: 0 },
            phase: 'completed',
            result: { outcome, reason: 'cracked', turns: 4 },
            botDifficulty: 'normal',
          } as never,
        });
      }

      // Mode 1 win × normal difficulty → computeReward(100, 'normal') = 120.
      // Tests use `match-A` as the canonical id throughout.

      it('valid match win: credits the doubled amount (computed internally), increments ad cap, resets counter', () => {
        seedCompletedWinMatch('match-A', 'player_won', 1);
        useUserStore.setState({
          tokens: 100,
          adsWatchedToday: 0,
          adsWatchedLastDate: null,
          matchesSinceLastInterstitial: 2,
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: true, doubledAmount: 120 });
        const state = useUserStore.getState();
        expect(state.tokens).toBe(220); // 100 + 120
        expect(state.adsWatchedToday).toBe(1);
        expect(state.adsWatchedLastDate).toBe('2026-05-05');
        // Q9 — Double consumes the cadence slot; counter resets.
        expect(state.matchesSinceLastInterstitial).toBe(0);
      });

      it('rejects no_match when matchState is null (defensive)', () => {
        useMatchStore.getState().clearMatch();
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: false, error: 'no_match' });
      });

      it('rejects wrong_id when supplied id does not match active match (Codex finding 1 — exploit closure)', () => {
        seedCompletedWinMatch('match-A');
        const result = useUserStore.getState().applyRewardedDouble('match-WRONG');
        expect(result).toEqual({ success: false, error: 'wrong_id' });
        // No state mutation on reject.
        expect(useUserStore.getState().adsWatchedToday).toBe(0);
      });

      it('rejects not_completed when matchState.phase is not completed', () => {
        useMatchStore.setState({
          matchState: {
            id: 'match-A',
            modeId: 1,
            playerSecret: '1234',
            opponentSecret: '5678',
            playerGuesses: [],
            opponentGuesses: [],
            rngState: { seed: 1, callCount: 0 },
            phase: 'active_turn_player',
            result: null,
            botDifficulty: 'normal',
          } as never,
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: false, error: 'not_completed' });
      });

      it('rejects wrong_outcome on a defeat (no reward to double)', () => {
        useMatchStore.setState({
          matchState: {
            id: 'match-A',
            modeId: 1,
            playerSecret: '1234',
            opponentSecret: '5678',
            playerGuesses: [],
            opponentGuesses: [],
            rngState: { seed: 1, callCount: 0 },
            phase: 'completed',
            result: { outcome: 'opponent_won', reason: 'cracked', turns: 6 },
            botDifficulty: 'normal',
          } as never,
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: false, error: 'wrong_outcome' });
      });

      it('rejects wrong_outcome on a stalemate (refund is the original transaction, not earned)', () => {
        useMatchStore.setState({
          matchState: {
            id: 'match-A',
            modeId: 1,
            playerSecret: '1234',
            opponentSecret: '5678',
            playerGuesses: [],
            opponentGuesses: [],
            rngState: { seed: 1, callCount: 0 },
            phase: 'completed',
            result: { outcome: 'stalemate', reason: 'both_exhausted', turns: 8 },
            botDifficulty: 'normal',
          } as never,
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: false, error: 'wrong_outcome' });
      });

      it('rejects already_doubled (idempotency — second call on the same match)', () => {
        seedCompletedWinMatch('match-A');
        // First call succeeds. Action does NOT auto-set doubledReward
        // (the AdWatchScreen calls setDoubledReward post-success), so
        // simulate that here for the second-call test.
        const first = useUserStore.getState().applyRewardedDouble('match-A');
        expect(first.success).toBe(true);
        useMatchStore.getState().setDoubledReward(true);
        // Second call should reject.
        const second = useUserStore.getState().applyRewardedDouble('match-A');
        expect(second).toEqual({ success: false, error: 'already_doubled' });
      });

      it('rejects cap_reached when ad cap is at 10/10 for today', () => {
        seedCompletedWinMatch('match-A');
        useUserStore.setState({
          adsWatchedToday: 10,
          adsWatchedLastDate: '2026-05-05',
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: false, error: 'cap_reached' });
      });

      it('cross-midnight stale lastDate: cap resets, double credits cleanly', () => {
        seedCompletedWinMatch('match-A');
        useUserStore.setState({
          tokens: 50,
          adsWatchedToday: 10,
          adsWatchedLastDate: '2026-05-04', // yesterday — stale
          matchesSinceLastInterstitial: 3,
        });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result).toEqual({ success: true, doubledAmount: 120 });
        const state = useUserStore.getState();
        expect(state.tokens).toBe(170); // 50 + 120
        expect(state.adsWatchedToday).toBe(1);
        expect(state.adsWatchedLastDate).toBe('2026-05-05');
      });

      it('cannot be exploited via injected reward (signature change enforces validation)', () => {
        // The pre-fix signature accepted a caller-supplied amount.
        // The new signature only accepts matchId; the action reads
        // matchState authoritatively. A draw on Mode 1 yields the
        // catalog draw reward × DDA = 50 × 1.2 = 60, NOT some
        // arbitrary number a caller could have specified.
        seedCompletedWinMatch('match-A', 'draw', 1);
        useUserStore.setState({ tokens: 0 });
        const result = useUserStore.getState().applyRewardedDouble('match-A');
        expect(result.success).toBe(true);
        expect(result.doubledAmount).toBe(60); // not, e.g., 99999
        expect(useUserStore.getState().tokens).toBe(60);
      });
    });

    describe('watchAdAction', () => {
      it('first-ever watch: success, +50 tokens, counter bumps to 1', () => {
        const tokensBefore = useUserStore.getState().tokens;
        const result = useUserStore.getState().watchAdAction('2026-05-05');
        expect(result).toEqual({ success: true, reward: 50 });
        expect(useUserStore.getState().tokens).toBe(tokensBefore + 50);
        expect(useUserStore.getState().adsWatchedToday).toBe(1);
        expect(useUserStore.getState().adsWatchedLastDate).toBe('2026-05-05');
      });

      it('cap reached: refusal, no token credit, no state mutation', () => {
        useUserStore.setState({
          adsWatchedToday: 10,
          adsWatchedLastDate: '2026-05-05',
        });
        const tokensBefore = useUserStore.getState().tokens;
        const result = useUserStore.getState().watchAdAction('2026-05-05');
        expect(result).toEqual({ success: false, reward: 0 });
        expect(useUserStore.getState().tokens).toBe(tokensBefore);
        expect(useUserStore.getState().adsWatchedToday).toBe(10);
      });

      it('cross-midnight: stale day at cap → fresh quota, success', () => {
        useUserStore.setState({
          adsWatchedToday: 10,
          adsWatchedLastDate: '2026-05-04',
        });
        const result = useUserStore.getState().watchAdAction('2026-05-05');
        expect(result).toEqual({ success: true, reward: 50 });
        expect(useUserStore.getState().adsWatchedToday).toBe(1);
        expect(useUserStore.getState().adsWatchedLastDate).toBe('2026-05-05');
      });
    });
  });

  describe('Phase 7A.5 CP1 — Daily-Challenge ad-free invariant', () => {
    // Daily Challenge must never increment `matchesSinceLastInterstitial`.
    // The Mode 1–7 match-completion seam is the *only* call site
    // that bumps this counter (CP3 wires it). If a future PR
    // accidentally folds an increment into `recordDailyResult` /
    // `recordMissedDay`, this test fails — surfacing the invariant
    // break before review.

    it('recordDailyResult does NOT bump matchesSinceLastInterstitial', () => {
      useUserStore.setState({ matchesSinceLastInterstitial: 0 });
      useUserStore.getState().recordDailyResult({
        date: '2026-05-05',
        digits: 4,
        turnLimit: 10,
        turnsUsed: 3,
        success: true,
        secret: '1234',
        feedbackTrail: [],
        hintsUsed: 0,
      });
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    });

    it('recordMissedDay does NOT bump matchesSinceLastInterstitial', () => {
      useUserStore.setState({
        matchesSinceLastInterstitial: 0,
        dailyChallenge: {
          ...USER_STORE_DEFAULTS.dailyChallenge,
          lastPlayedDate: '2026-05-03',
          currentStreak: 4,
        },
      });
      useUserStore.getState().recordMissedDay('2026-05-05');
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    });

    it('recordMatchResult does NOT auto-increment — CP3 wires the bump at MatchResultScreen mount, not in this action', () => {
      // CP3 chose option (a) — explicit incrementMatchCounter()
      // call from MatchResultScreen's mount effect, NOT folded
      // into recordMatchResult. This test pins the action-level
      // contract: a direct caller of recordMatchResult (e.g. a
      // future test fixture or admin tool) does not advance the
      // interstitial counter. The screen-level wiring is exercised
      // in MatchResultScreen.test.tsx's Phase 7A.5 CP3 block.
      useUserStore.setState({ matchesSinceLastInterstitial: 0 });
      useUserStore.getState().recordMatchResult({
        modeId: 1,
        outcome: 'victory',
        turns: 3,
        tokensEarnedThisMatch: 100,
      });
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    });
  });
});
