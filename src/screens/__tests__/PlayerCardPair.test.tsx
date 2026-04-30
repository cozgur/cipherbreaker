/**
 * PlayerCardPair — `activeSide` prop unit test. CP3 extended the
 * prop from `'self' | 'opponent'` to `'self' | 'opponent' | 'both'`
 * for parallel modes (Mode 6 post-flip, Mode 7 conceptually). This
 * test pins the rendering contract:
 *   - 'self' → only the left card carries the active border
 *   - 'opponent' → only the right card carries the active border
 *   - 'both' → BOTH cards carry the active border (parallel glow)
 *
 * The MatchScreen call site still hands `'self' | 'opponent'` until
 * CP4 wires the parallel flag through. This test exists ahead of CP4
 * so the prop's contract is locked in before any caller depends on
 * the `'both'` branch.
 */

import { render } from '@testing-library/react-native';

/**
 * Minimal structural shape of a `react-test-renderer` instance —
 * inlined to avoid a `@types/react-test-renderer` dev dep just for
 * one test.
 */
interface TestNode {
  readonly type: string | { readonly name?: string };
  readonly props: { readonly style?: unknown };
}

import { findMode } from '@data/modeCatalog';
import { PlayerCardPair } from '../MatchScreen';
import { colors } from '@theme/tokens';

function renderPair(activeSide: 'self' | 'opponent' | 'both') {
  return render(
    <PlayerCardPair
      selfName="Player"
      opponentName="Rival"
      opponentLevel={3}
      mode={findMode(1)}
      timeline={[]}
      activeSide={activeSide}
      liveClocks={null}
    />,
  );
}

/**
 * Walk the rendered subtree to find the two playerCard `View`s and
 * report whether each carries the violet border (= active). Active
 * is rendered as `borderColor: colors.violet` via `playerCardActive`
 * style; inactive uses the dimmer `borderSubtle`. Reading the
 * computed style array directly is the most robust contract check —
 * snapshotting would couple the test to unrelated layout/clock
 * details.
 */
function readActiveStates(tree: ReturnType<typeof renderPair>): {
  selfActive: boolean;
  opponentActive: boolean;
} {
  const cards = tree.UNSAFE_root.findAll(
    (node: TestNode) =>
      node.type === 'View' &&
      Array.isArray(node.props.style) &&
      (node.props.style as readonly unknown[]).some(
        (s) =>
          typeof s === 'object' && s !== null && 'borderColor' in s && 'borderRadius' in s,
      ),
  );
  if (cards.length < 2) {
    throw new Error(`expected at least 2 playerCard nodes, found ${cards.length}`);
  }
  const isActive = (node: TestNode): boolean => {
    const styles = node.props.style as readonly unknown[];
    return styles.some(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        'borderColor' in s &&
        (s as { borderColor: string }).borderColor === colors.violet,
    );
  };
  return {
    selfActive: isActive(cards[0]),
    opponentActive: isActive(cards[1]),
  };
}

describe('PlayerCardPair — activeSide prop', () => {
  it("activeSide='self' lights up the left (self) card only", () => {
    const tree = renderPair('self');
    const { selfActive, opponentActive } = readActiveStates(tree);
    expect(selfActive).toBe(true);
    expect(opponentActive).toBe(false);
  });

  it("activeSide='opponent' lights up the right (opponent) card only", () => {
    const tree = renderPair('opponent');
    const { selfActive, opponentActive } = readActiveStates(tree);
    expect(selfActive).toBe(false);
    expect(opponentActive).toBe(true);
  });

  it("activeSide='both' lights up BOTH cards (parallel-mode glow)", () => {
    const tree = renderPair('both');
    const { selfActive, opponentActive } = readActiveStates(tree);
    expect(selfActive).toBe(true);
    expect(opponentActive).toBe(true);
  });
});
