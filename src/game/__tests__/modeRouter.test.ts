import { nextRouteAfterMatchmaking } from '../modeRouter';

describe('nextRouteAfterMatchmaking', () => {
  it('routes Modes 1-6 through SecretSetup', () => {
    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(nextRouteAfterMatchmaking(id)).toBe('SecretSetup');
    }
  });

  it('routes Mode 7 (Mirror) directly into Match — no player-set secret', () => {
    expect(nextRouteAfterMatchmaking(7)).toBe('Match');
  });

  it('falls back to SecretSetup for an unknown mode id', () => {
    expect(nextRouteAfterMatchmaking(999)).toBe('SecretSetup');
  });
});
