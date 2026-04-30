/**
 * MatchScreen — parallel-engine paths (Mode 6 Sudden Death + Mode 7
 * Mirror). CP4 wired the conditionals on top of CP3's flag flip.
 *
 * What this suite pins:
 *   - Mode 7 leak regression (Bug 3): seeded `opponentGuesses` digits
 *     do NOT appear in the rendered timeline. Snapshot alone wouldn't
 *     catch a future revert because the snapshot is a tree dump and
 *     a leak would show up as a positive diff that's easy to `-u`
 *     past — this assertion fails loudly.
 *   - Mode 6 active_parallel: PlayerCardPair renders both cards with
 *     active glow (`activeSide='both'`); interleaved timeline shows
 *     both sides; "RACING" label.
 *   - Mode 7 active_parallel: SoloRaceBanner with the "Rival: N
 *     guesses" badge surfacing the live opponent count.
 *   - Snapshots: Mode 6 active_parallel + Mode 7 active_parallel
 *     (engine-seeded, with badge).
 */

import { MatchScreen } from '@screens/MatchScreen';
import { __resetRegistryForTests, modeRegistry } from '@game/modeRegistry';
import { mode6SuddenDeath } from '@game/modes/mode6SuddenDeath';
import { mode7Mirror } from '@game/modes/mode7Mirror';
import type { GuessEntry, MatchState } from '@game/types';
import { useMatchStore } from '@state/matchStore';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';
import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { colors } from '@theme/tokens';

function makeOpponentEntry(guessIndex: number, digits: readonly number[]): GuessEntry {
  return {
    side: 'opponent',
    guessIndex,
    digits,
    feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
  };
}

function makePlayerEntry(guessIndex: number, digits: readonly number[]): GuessEntry {
  return {
    side: 'self',
    guessIndex,
    digits,
    feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
  };
}

function seedParallelMatch(opts: {
  readonly modeId: 6 | 7;
  readonly playerSecret: string;
  readonly opponentSecret: string;
  readonly playerGuesses?: readonly GuessEntry[];
  readonly opponentGuesses?: readonly GuessEntry[];
  readonly guessLimits?: { readonly playerRemaining: number; readonly opponentRemaining: number };
}): MatchState {
  const now = Date.now();
  const state: MatchState = {
    modeId: opts.modeId,
    playerSecret: opts.playerSecret,
    opponentSecret: opts.opponentSecret,
    playerGuesses: opts.playerGuesses ?? [],
    opponentGuesses: opts.opponentGuesses ?? [],
    phase: 'active_parallel',
    result: null,
    rngState: { seed: 1, callCount: 0 },
    botDifficulty: 'normal',
    firstAuthor: 'self',
    startedAt: now,
    lastUpdatedAt: now,
    ...(opts.guessLimits !== undefined ? { guessLimits: opts.guessLimits } : {}),
  };
  useMatchStore.setState({ matchState: state });
  return state;
}

function renderMatch(modeId: 6 | 7) {
  return renderWithNavigation(
    'Match',
    { Match: MatchScreen },
    { modeId, opponentId: 'opp-1' },
  );
}

beforeEach(() => {
  __resetRegistryForTests();
  modeRegistry.register(mode6SuddenDeath);
  modeRegistry.register(mode7Mirror);
  __resetMockUserForTests();
  mockUser.username = 'phoenix99';
});

afterEach(() => {
  useMatchStore.getState().clearMatch();
});

describe('Mode 7 — Bug 3 leak regression', () => {
  it('opponentGuesses digits do NOT appear in any rendered Text node', () => {
    // Seed opponent guesses with very distinctive 4-digit strings —
    // if any of these leak into the timeline (interleaveTimeline
    // mistake / future revert) the assertion catches it.
    seedParallelMatch({
      modeId: 7,
      playerSecret: '5678',
      opponentSecret: '5678',
      opponentGuesses: [
        makeOpponentEntry(1, [9, 9, 9, 9]),
        makeOpponentEntry(2, [8, 8, 8, 8]),
        makeOpponentEntry(3, [7, 7, 7, 7]),
      ],
    });
    const utils = renderMatch(7);
    const texts = collectTextNodes(utils.toJSON());
    for (const t of texts) {
      expect(t).not.toContain('9999');
      expect(t).not.toContain('8888');
      expect(t).not.toContain('7777');
    }
  });

  it('opponent guess count badge surfaces the count without leaking digits', () => {
    seedParallelMatch({
      modeId: 7,
      playerSecret: '5678',
      opponentSecret: '5678',
      opponentGuesses: [
        makeOpponentEntry(1, [9, 9, 9, 9]),
        makeOpponentEntry(2, [8, 8, 8, 8]),
      ],
    });
    const utils = renderMatch(7);
    expect(utils.queryByText(/shadowHunter47: 2 guesses/)).toBeTruthy();
    expect(utils.queryByText(/9999|8888/)).toBeNull();
  });

  it('player guesses still render in the Mirror timeline (single-perspective stays alive)', () => {
    seedParallelMatch({
      modeId: 7,
      playerSecret: '5678',
      opponentSecret: '5678',
      playerGuesses: [makePlayerEntry(1, [1, 2, 3, 4])],
    });
    const utils = renderMatch(7);
    // Player's own guess digits SHOULD appear — Mirror just hides
    // the rival's.
    const texts = collectTextNodes(utils.toJSON());
    const joined = texts.join('|');
    expect(joined).toContain('1');
    expect(joined).toContain('2');
    expect(joined).toContain('3');
    expect(joined).toContain('4');
  });
});

describe('Mode 7 — RACING label + SoloRaceBanner integration', () => {
  it('shows RACING (not YOUR TURN) when phase=active_parallel', () => {
    seedParallelMatch({
      modeId: 7,
      playerSecret: '5678',
      opponentSecret: '5678',
    });
    const utils = renderMatch(7);
    expect(utils.queryByText('RACING')).toBeTruthy();
    expect(utils.queryByText('YOUR TURN')).toBeNull();
  });

  it('snapshots the Mode 7 active_parallel layout (engine path, opponent count badge present)', () => {
    seedParallelMatch({
      modeId: 7,
      playerSecret: '5678',
      opponentSecret: '5678',
      opponentGuesses: [makeOpponentEntry(1, [9, 9, 9, 9])],
    });
    const utils = renderMatch(7);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });
});

describe('Mode 6 — active_parallel UI wiring', () => {
  it("activeSide='both' lights up BOTH player cards (parallel glow)", () => {
    seedParallelMatch({
      modeId: 6,
      playerSecret: '4321',
      opponentSecret: '5678',
      guessLimits: { playerRemaining: 5, opponentRemaining: 5 },
    });
    const utils = renderMatch(6);
    // Find the two playerCard `View`s — each carries the active
    // border (colors.violet) when its side is glowing. With 'both',
    // both cards show the active border.
    const cards = collectActiveCards(utils.toJSON());
    expect(cards.length).toBe(2);
    expect(cards.every((c) => c.active)).toBe(true);
  });

  it("activeSide drops to 'opponent' when player budget is exhausted", () => {
    seedParallelMatch({
      modeId: 6,
      playerSecret: '4321',
      opponentSecret: '5678',
      guessLimits: { playerRemaining: 0, opponentRemaining: 3 },
    });
    const utils = renderMatch(6);
    const cards = collectActiveCards(utils.toJSON());
    expect(cards.length).toBe(2);
    // Self card (index 0) — inactive; opponent card (index 1) — active.
    expect(cards[0]?.active).toBe(false);
    expect(cards[1]?.active).toBe(true);
  });

  it('shows RACING label and "is guessing" verb (parallel mode)', () => {
    seedParallelMatch({
      modeId: 6,
      playerSecret: '4321',
      opponentSecret: '5678',
      guessLimits: { playerRemaining: 5, opponentRemaining: 5 },
    });
    const utils = renderMatch(6);
    expect(utils.queryByText('RACING')).toBeTruthy();
    // BotTypingFooter is gated on `showBotTyping` (state-driven) —
    // assert the static turn label here, not the typing footer.
    expect(utils.queryByText('YOUR TURN')).toBeNull();
    expect(utils.queryByText("OPPONENT'S TURN")).toBeNull();
  });

  it('timeline still INTERLEAVES player + opponent guesses (Mode 6 ≠ Mirror)', () => {
    // Mode 6 is parallel but face-to-face — both sides see each
    // other's guesses. Mirror is the only mode that hides them.
    seedParallelMatch({
      modeId: 6,
      playerSecret: '4321',
      opponentSecret: '5678',
      playerGuesses: [makePlayerEntry(1, [1, 1, 1, 1])],
      opponentGuesses: [makeOpponentEntry(1, [2, 2, 2, 2])],
      guessLimits: { playerRemaining: 4, opponentRemaining: 4 },
    });
    const utils = renderMatch(6);
    const texts = collectTextNodes(utils.toJSON()).join('|');
    // Both sides' digits must be present.
    expect(texts).toContain('1');
    expect(texts).toContain('2');
  });

  it('snapshots the Mode 6 active_parallel layout', () => {
    seedParallelMatch({
      modeId: 6,
      playerSecret: '4321',
      opponentSecret: '5678',
      guessLimits: { playerRemaining: 5, opponentRemaining: 5 },
    });
    const utils = renderMatch(6);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────
// Local helpers — JSON tree walkers
// ─────────────────────────────────────────────────────────────

function collectTextNodes(tree: unknown, into: string[] = []): string[] {
  if (tree === null || typeof tree !== 'object') return into;
  const node = tree as { type?: string; children?: unknown };
  if (node.type === 'Text' && Array.isArray(node.children)) {
    for (const c of node.children) {
      if (typeof c === 'string') into.push(c);
    }
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectTextNodes(c, into);
  }
  return into;
}

interface ActiveCard {
  readonly active: boolean;
}

/**
 * Walk the rendered tree to find the two `playerCard` Views and
 * report their active state. A playerCard is identified by the
 * presence of `borderRadius: 14` + `borderColor` in its style array
 * (the inline shape from `styles.playerCard`). Active = the merged
 * style includes `borderColor: colors.violet` (from
 * `styles.playerCardActive`).
 */
function collectActiveCards(tree: unknown): ActiveCard[] {
  const out: ActiveCard[] = [];
  walk(tree, (node) => {
    const styles = node.props?.style;
    if (!Array.isArray(styles)) return;
    const looksLikePlayerCard = styles.some(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        'borderRadius' in s &&
        (s as { borderRadius: unknown }).borderRadius === 14 &&
        'paddingVertical' in s,
    );
    if (!looksLikePlayerCard) return;
    const active = styles.some(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        'borderColor' in s &&
        (s as { borderColor: string }).borderColor === colors.violet,
    );
    out.push({ active });
  });
  return out;
}

function walk(
  tree: unknown,
  visit: (node: { readonly type?: string; readonly props?: { readonly style?: unknown } }) => void,
): void {
  if (tree === null || typeof tree !== 'object') return;
  const node = tree as {
    readonly type?: string;
    readonly props?: { readonly style?: unknown };
    readonly children?: unknown;
  };
  visit(node);
  if (Array.isArray(node.children)) {
    for (const c of node.children) walk(c, visit);
  }
}
