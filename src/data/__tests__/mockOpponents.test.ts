import { findOpponent, mockOpponents, pickRandomOpponent } from '../mockOpponents';

describe('mockOpponents', () => {
  it('ships with ten opponents', () => {
    expect(mockOpponents).toHaveLength(10);
  });

  it('has unique ids', () => {
    const ids = new Set(mockOpponents.map((o) => o.id));
    expect(ids.size).toBe(mockOpponents.length);
  });

  it('findOpponent returns the row for a known id and undefined otherwise', () => {
    expect(findOpponent('opp-1')?.username).toBe('shadowHunter47');
    expect(findOpponent('nope')).toBeUndefined();
  });

  it('pickRandomOpponent is deterministic when seeded', () => {
    const a = pickRandomOpponent(0);
    const b = pickRandomOpponent(0);
    expect(a).toBe(b);
  });

  it('pickRandomOpponent prefers online opponents', () => {
    const onlineIds = new Set(mockOpponents.filter((o) => o.isOnline).map((o) => o.id));
    for (let seed = 0; seed < 20; seed += 1) {
      const picked = pickRandomOpponent(seed);
      expect(onlineIds.has(picked.id)).toBe(true);
    }
  });
});
