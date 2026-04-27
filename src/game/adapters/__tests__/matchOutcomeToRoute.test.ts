import type { MatchResult } from '@game/types';

import { matchOutcomeToRoute } from '../matchOutcomeToRoute';

const cases: ReadonlyArray<{ result: MatchResult; expected: string }> = [
  {
    result: { outcome: 'player_won', reason: 'cracked', turns: 3 },
    expected: 'victory',
  },
  {
    result: { outcome: 'opponent_won', reason: 'cracked', turns: 3 },
    expected: 'defeat',
  },
  {
    result: { outcome: 'draw', reason: 'simultaneous_crack', turns: 4 },
    expected: 'draw',
  },
  {
    result: { outcome: 'stalemate', reason: 'both_exhausted', turns: 5 },
    expected: 'stalemate',
  },
];

describe('matchOutcomeToRoute', () => {
  it.each(cases)('maps $result.outcome → $expected', ({ result, expected }) => {
    expect(matchOutcomeToRoute(result)).toBe(expected);
  });
});
