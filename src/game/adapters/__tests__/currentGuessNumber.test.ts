import type { GuessEntry, MatchState } from '../../types';
import {
  currentGuessNumberFromMatch,
  currentGuessNumberFromMockTimeline,
} from '../currentGuessNumber';

function baseMatch(overrides: Partial<MatchState> = {}): MatchState {
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

function entry(side: 'self' | 'opponent', guessIndex: number): GuessEntry {
  return {
    side,
    guessIndex,
    digits: [0, 0, 0, 0],
    feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
  };
}

describe('currentGuessNumberFromMatch — engine path', () => {
  it('player_first match: P1 → Round 1 (player turn, no guesses yet)', () => {
    const state = baseMatch({ phase: 'active_turn_player' });
    expect(currentGuessNumberFromMatch(state)).toBe(1);
  });

  it('player_first match: after P1, opponent_turn → Round 1 (opponent about to play their 1st)', () => {
    const state = baseMatch({
      phase: 'active_turn_opponent',
      playerGuesses: [entry('self', 1)],
    });
    expect(currentGuessNumberFromMatch(state)).toBe(1);
  });

  it('player_first match: after P1+O1, player_turn → Round 2', () => {
    const state = baseMatch({
      phase: 'active_turn_player',
      playerGuesses: [entry('self', 1)],
      opponentGuesses: [entry('opponent', 1)],
    });
    expect(currentGuessNumberFromMatch(state)).toBe(2);
  });

  it('opponent_first match: O1 → Round 1 (opponent turn, no guesses yet)', () => {
    const state = baseMatch({ phase: 'active_turn_opponent' });
    expect(currentGuessNumberFromMatch(state)).toBe(1);
  });

  it('opponent_first match: after O1, player_turn → Round 1 (player about to play their 1st)', () => {
    const state = baseMatch({
      phase: 'active_turn_player',
      opponentGuesses: [entry('opponent', 1)],
    });
    expect(currentGuessNumberFromMatch(state)).toBe(1);
  });

  it('player_won on 12th guess: completed phase reads back the winner count (matches result.turns)', () => {
    const playerGuesses = Array.from({ length: 12 }, (_, i) => entry('self', i + 1));
    const opponentGuesses = Array.from({ length: 11 }, (_, i) => entry('opponent', i + 1));
    const state = baseMatch({
      phase: 'completed',
      playerGuesses,
      opponentGuesses,
      result: { outcome: 'player_won', reason: 'cracked', turns: 12 },
    });
    expect(currentGuessNumberFromMatch(state)).toBe(12);
  });

  it('mirror parallel: counts player\'s own guesses + 1', () => {
    const state = baseMatch({
      phase: 'active_parallel',
      playerGuesses: [entry('self', 1), entry('self', 2)],
      opponentGuesses: [entry('opponent', 1)],
    });
    expect(currentGuessNumberFromMatch(state)).toBe(3);
  });
});

describe('currentGuessNumberFromMockTimeline — Phase 1B fallback', () => {
  it('counts only self entries plus 1', () => {
    const timeline: readonly GuessEntry[] = [
      entry('self', 1),
      entry('opponent', 1),
      entry('self', 2),
      entry('opponent', 2),
    ];
    expect(currentGuessNumberFromMockTimeline(timeline)).toBe(3);
  });

  it('empty timeline → 1', () => {
    expect(currentGuessNumberFromMockTimeline([])).toBe(1);
  });
});
