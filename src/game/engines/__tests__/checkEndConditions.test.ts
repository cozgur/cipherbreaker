import type {
  ClockSnapshot,
  GuessEntry,
  GuessLimits,
  MatchState,
  ModeDefinition,
  NormalizedFeedback,
} from '../../types';
import { checkEndConditions } from '../checkEndConditions';

function makeMode(overrides: Partial<ModeDefinition['rules']> = {}): ModeDefinition {
  return {
    id: 1,
    meta: {
      section: 'CLASSIC',
      name: 'TEST',
      shortLabel: 'TEST',
      description: 'fixture',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: ['#000', '#fff'],
      iconKey: 'color-match',
    },
    rules: { secretLength: 4, digitsUnique: false, flags: {}, ...overrides },
    generateSecret: () => '1234',
    validateGuess: () => ({ ok: true }),
    evaluate: () => ({ kind: 'colorMatch', states: [] }),
    bot: {
      initSolverState: () => ({ kind: 'candidatePool', pool: [] }),
      makeGuess: async () => ({
        guess: '0000',
        newSolverState: { kind: 'candidatePool', pool: [] },
      }),
      thinkingTime: () => 2000,
    },
  };
}

function entry(side: 'self' | 'opponent', isWin: boolean, idx: number = 1): GuessEntry {
  const feedback: NormalizedFeedback = {
    kind: 'colorMatch',
    states: ['green', 'green', 'green', isWin ? 'green' : 'gray'],
    isWin,
  };
  return { side, guessIndex: idx, digits: [1, 2, 3, 4], feedback };
}

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    modeId: 1,
    playerSecret: '1234',
    opponentSecret: '5678',
    playerGuesses: [],
    opponentGuesses: [],
    phase: 'active_turn_player',
    result: null,
    rngState: { seed: 1, callCount: 0 },
    startedAt: 0,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe('checkEndConditions', () => {
  it('returns null while the match is in progress', () => {
    const mode = makeMode();
    const state = makeState({ playerGuesses: [entry('self', false)] });
    expect(checkEndConditions(state, mode)).toBeNull();
  });

  it('player_won/cracked when only the player wins this turn', () => {
    const mode = makeMode();
    const state = makeState({ playerGuesses: [entry('self', true, 3)] });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({ outcome: 'player_won', reason: 'cracked', turns: 1 });
  });

  it('opponent_won/cracked when only the opponent wins this turn', () => {
    const mode = makeMode();
    const state = makeState({ opponentGuesses: [entry('opponent', true)] });
    const result = checkEndConditions(state, mode);
    expect(result?.outcome).toBe('opponent_won');
    expect(result?.reason).toBe('cracked');
  });

  it('draw/simultaneous_crack when both sides win in the same turn', () => {
    const mode = makeMode();
    const state = makeState({
      playerGuesses: [entry('self', true)],
      opponentGuesses: [entry('opponent', true)],
    });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({ outcome: 'draw', reason: 'simultaneous_crack', turns: 1 });
  });

  it('player_time_out when Mode 4 player clock hits zero', () => {
    const mode = makeMode({ perPlayerTimeLimitMs: 60_000 });
    const snapshot: ClockSnapshot = {
      playerMs: 0,
      opponentMs: 30_000,
      activeOwner: 'player',
      snapshotTimestamp: 0,
    };
    const state = makeState({ clockSnapshot: snapshot });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({ outcome: 'opponent_won', reason: 'player_time_out', turns: 0 });
  });

  it('opponent_time_out when Mode 4 opponent clock hits zero', () => {
    const mode = makeMode({ perPlayerTimeLimitMs: 60_000 });
    const snapshot: ClockSnapshot = {
      playerMs: 5_000,
      opponentMs: 0,
      activeOwner: 'opponent',
      snapshotTimestamp: 0,
    };
    const state = makeState({ clockSnapshot: snapshot });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({ outcome: 'player_won', reason: 'opponent_time_out', turns: 0 });
  });

  it('Mode 6 player_guess_limit when only the player exhausts', () => {
    const mode = makeMode({ maxGuessesPerPlayer: 5 });
    const limits: GuessLimits = { playerRemaining: 0, opponentRemaining: 1 };
    const state = makeState({ guessLimits: limits });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({
      outcome: 'opponent_won',
      reason: 'player_guess_limit',
      turns: 0,
    });
  });

  it('Mode 6 opponent_guess_limit when only the opponent exhausts', () => {
    const mode = makeMode({ maxGuessesPerPlayer: 5 });
    const limits: GuessLimits = { playerRemaining: 2, opponentRemaining: 0 };
    const state = makeState({ guessLimits: limits });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({
      outcome: 'player_won',
      reason: 'opponent_guess_limit',
      turns: 0,
    });
  });

  it('Mode 6 stalemate/both_exhausted when both run out', () => {
    const mode = makeMode({ maxGuessesPerPlayer: 5 });
    const limits: GuessLimits = { playerRemaining: 0, opponentRemaining: 0 };
    const state = makeState({ guessLimits: limits });
    const result = checkEndConditions(state, mode);
    expect(result).toEqual({ outcome: 'stalemate', reason: 'both_exhausted', turns: 0 });
  });

  it('crack precedence — a crack on the same turn beats a guess-limit exhaustion', () => {
    const mode = makeMode({ maxGuessesPerPlayer: 5 });
    const state = makeState({
      playerGuesses: [entry('self', true)],
      guessLimits: { playerRemaining: 0, opponentRemaining: 1 },
    });
    const result = checkEndConditions(state, mode);
    expect(result?.outcome).toBe('player_won');
    expect(result?.reason).toBe('cracked');
  });

  it('isWin defensive read — feedback without isWin is treated as no win', () => {
    const mode = makeMode();
    const noIsWin: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [1, 2, 3, 4],
      feedback: { kind: 'colorMatch', states: [] },
    };
    const state = makeState({ playerGuesses: [noIsWin] });
    expect(checkEndConditions(state, mode)).toBeNull();
  });

  it('totalTurns reflects the side with more guesses', () => {
    const mode = makeMode();
    const state = makeState({
      playerGuesses: [entry('self', false), entry('self', true, 2)],
      opponentGuesses: [entry('opponent', false)],
    });
    const result = checkEndConditions(state, mode);
    expect(result?.turns).toBe(2);
  });
});
