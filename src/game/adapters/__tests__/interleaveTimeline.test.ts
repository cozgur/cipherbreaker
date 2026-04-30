import type { GuessEntry, MatchState } from '@game/types';

import { interleaveTimeline } from '../interleaveTimeline';

function entry(side: 'self' | 'opponent', index: number, createdAt?: number): GuessEntry {
  return {
    side,
    guessIndex: index,
    digits: [index, index, index, index],
    feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
    ...(createdAt !== undefined ? { createdAt } : {}),
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

  // ─────────────────────────────────────────────────────────────
  // Phase 6 CP5 — chronological mode for parallel-engine modes
  // (Mode 6 Sudden Death). Both sides submit independently, so the
  // turn-based alternation walk would render the timeline in the
  // wrong order vs what the player actually saw on screen.
  // ─────────────────────────────────────────────────────────────
  describe('chronological merge (Mode 6 parallel)', () => {
    it('player submitted before opponent → player appears first', () => {
      const out = interleaveTimeline(
        makeState({
          playerGuesses: [entry('self', 1, 100)],
          opponentGuesses: [entry('opponent', 1, 200)],
        }),
        { chronological: true },
      );
      expect(out.map((e) => e.side)).toEqual(['self', 'opponent']);
    });

    it('opponent submitted before player → opponent appears first', () => {
      const out = interleaveTimeline(
        makeState({
          playerGuesses: [entry('self', 1, 200)],
          opponentGuesses: [entry('opponent', 1, 100)],
        }),
        { chronological: true },
      );
      expect(out.map((e) => e.side)).toEqual(['opponent', 'self']);
    });

    it('interleaves multiple submissions from each side by timestamp', () => {
      const out = interleaveTimeline(
        makeState({
          // Player: t=100, t=400. Opponent: t=200, t=300, t=500.
          // Expected wall-clock order: P100, O200, O300, P400, O500.
          playerGuesses: [entry('self', 1, 100), entry('self', 2, 400)],
          opponentGuesses: [
            entry('opponent', 1, 200),
            entry('opponent', 2, 300),
            entry('opponent', 3, 500),
          ],
        }),
        { chronological: true },
      );
      expect(out.map((e) => [e.side, e.createdAt])).toEqual([
        ['self', 100],
        ['opponent', 200],
        ['opponent', 300],
        ['self', 400],
        ['opponent', 500],
      ]);
    });

    it('tie-break: player wins when timestamps are exactly equal (viewer-anchored)', () => {
      const out = interleaveTimeline(
        makeState({
          playerGuesses: [entry('self', 1, 500)],
          opponentGuesses: [entry('opponent', 1, 500)],
        }),
        { chronological: true },
      );
      expect(out.map((e) => e.side)).toEqual(['self', 'opponent']);
    });

    it('drains the longer side after the other is exhausted', () => {
      const out = interleaveTimeline(
        makeState({
          playerGuesses: [entry('self', 1, 100), entry('self', 2, 200)],
          opponentGuesses: [
            entry('opponent', 1, 300),
            entry('opponent', 2, 400),
            entry('opponent', 3, 500),
          ],
        }),
        { chronological: true },
      );
      expect(out.map((e) => e.side)).toEqual([
        'self',
        'self',
        'opponent',
        'opponent',
        'opponent',
      ]);
    });

    it('treats missing createdAt as 0 (legacy hydrate fallback)', () => {
      const out = interleaveTimeline(
        makeState({
          // Pre-CP5 entries hydrate without createdAt — sort to the
          // front of their queue, opponent's stamped entry follows.
          playerGuesses: [entry('self', 1)],
          opponentGuesses: [entry('opponent', 1, 100)],
        }),
        { chronological: true },
      );
      expect(out.map((e) => e.side)).toEqual(['self', 'opponent']);
    });
  });
});
