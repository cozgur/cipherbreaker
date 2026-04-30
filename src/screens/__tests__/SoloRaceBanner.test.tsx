/**
 * SoloRaceBanner — Mode 7 (Mirror) variant of the player area.
 * CP4 added the `opponentGuessCount` prop so the racing player has
 * a coarse signal of how close the rival is *without* leaking the
 * rival's individual guesses or feedback (Bug 3 invariant). This
 * test pins the badge contract:
 *   - undefined count → no badge (mock path stays clean)
 *   - 0 → "0 guesses" (plural for zero, matches English convention)
 *   - 1 → "1 guess" (singular)
 *   - N > 1 → "N guesses"
 */

import { render } from '@testing-library/react-native';

import { SoloRaceBanner } from '../MatchScreen';

function renderBanner(opponentGuessCount?: number) {
  return render(
    <SoloRaceBanner
      opponentName="Rival"
      opponentLevel={3}
      opponentGuessCount={opponentGuessCount}
    />,
  );
}

describe('SoloRaceBanner — opponentGuessCount badge', () => {
  it('renders the always-on copy (SOLO RACE tag + headline + opponent meta)', () => {
    const utils = renderBanner();
    expect(utils.queryByText('SOLO RACE')).toBeTruthy();
    expect(utils.queryByText('Both solving the same code')).toBeTruthy();
    expect(utils.queryByText(/Rival · Lv\. 3/)).toBeTruthy();
  });

  it('omits the badge when opponentGuessCount is undefined (mock path)', () => {
    const utils = renderBanner(undefined);
    expect(utils.queryByText(/Rival: \d+ guess/)).toBeNull();
  });

  it('renders "0 guesses" (plural for zero)', () => {
    const utils = renderBanner(0);
    expect(utils.queryByText('Rival: 0 guesses')).toBeTruthy();
  });

  it('renders "1 guess" (singular)', () => {
    const utils = renderBanner(1);
    expect(utils.queryByText('Rival: 1 guess')).toBeTruthy();
    expect(utils.queryByText('Rival: 1 guesses')).toBeNull();
  });

  it('renders "N guesses" for N > 1', () => {
    const utils = renderBanner(7);
    expect(utils.queryByText('Rival: 7 guesses')).toBeTruthy();
  });

  it("renders only opponent meta + count (no digits in any rendered Text node)", () => {
    // Defensive — even if a future change widens the prop surface,
    // the banner's only digit-emitting Text nodes are the level
    // ("Lv. 3") and the count ("Rival: 7 guesses"). A leaked 4-digit
    // guess would have to slip through one of those Texts. We walk
    // every text string in the tree and reject anything matching a
    // 4-consecutive-digit run (the secret length).
    const utils = renderBanner(7);
    const findAllText = (node: unknown, into: string[]): void => {
      if (node === null || typeof node !== 'object') return;
      const n = node as { children?: unknown; type?: string };
      if (n.type === 'Text' && Array.isArray(n.children)) {
        for (const c of n.children) {
          if (typeof c === 'string') into.push(c);
        }
      }
      if (Array.isArray(n.children)) {
        for (const c of n.children) findAllText(c, into);
      }
    };
    const texts: string[] = [];
    findAllText(utils.toJSON(), texts);
    for (const t of texts) {
      expect(t).not.toMatch(/\d{4}/);
    }
  });
});
