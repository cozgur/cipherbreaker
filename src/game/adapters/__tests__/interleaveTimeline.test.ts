import type { GuessEntry, MatchState } from '@game/types';

import { interleaveTimeline } from '../interleaveTimeline';

function entry(side: 'self' | 'opponent', index: number): GuessEntry {
  return {
    side,
    guessIndex: index,
    digits: [index, index, index, index],
    feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
  };
}

function makeState(overrides: Partial<MatchState>): MatchState {
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

describe('interleaveTimeline', () => {
  it('returns an empty array when neither side has guessed', () => {
    expect(interleaveTimeline(makeState({ firstAuthor: 'self' }))).toEqual([]);
  });

  it('alternates self → opponent when self started first', () => {
    const out = interleaveTimeline(
      makeState({
        firstAuthor: 'self',
        playerGuesses: [entry('self', 1), entry('self', 2)],
        opponentGuesses: [entry('opponent', 1), entry('opponent', 2)],
      }),
    );
    expect(out.map((e) => e.side)).toEqual(['self', 'opponent', 'self', 'opponent']);
  });

  it('alternates opponent → self when opponent started first', () => {
    const out = interleaveTimeline(
      makeState({
        firstAuthor: 'opponent',
        playerGuesses: [entry('self', 1)],
        opponentGuesses: [entry('opponent', 1), entry('opponent', 2)],
      }),
    );
    expect(out.map((e) => e.side)).toEqual(['opponent', 'self', 'opponent']);
  });

  it('drains the longer side when one player has an extra unmatched turn', () => {
    const out = interleaveTimeline(
      makeState({
        firstAuthor: 'self',
        playerGuesses: [entry('self', 1), entry('self', 2), entry('self', 3)],
        opponentGuesses: [entry('opponent', 1), entry('opponent', 2)],
      }),
    );
    expect(out.map((e) => e.side)).toEqual(['self', 'opponent', 'self', 'opponent', 'self']);
  });

  it("falls back to 'self' when firstAuthor is undefined (pre-Phase-3 hydrate)", () => {
    const out = interleaveTimeline(
      makeState({
        playerGuesses: [entry('self', 1)],
        opponentGuesses: [entry('opponent', 1)],
      }),
    );
    expect(out.map((e) => e.side)).toEqual(['self', 'opponent']);
  });
});
