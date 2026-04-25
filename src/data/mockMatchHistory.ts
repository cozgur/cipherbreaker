/**
 * Mock match timelines per mode. Shape matches Phase 2's engine output
 * exactly — `GuessEntry[]` — so the MatchScreen consumer path is
 * future-proof. The reference prototype's `buildTimeline(mode)` lives
 * here, ported to typed domain shapes.
 */

import type { GuessEntry } from '@game/types';

const MODE_1_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [1, 2, 5, 8],
    feedback: { kind: 'colorMatch', states: ['yellow', 'gray', 'gray', 'green'] },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 4, 2, 6],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
  },
  {
    side: 'opponent',
    guessIndex: 2,
    digits: [6, 2, 4, 8],
    feedback: { kind: 'colorMatch', states: ['yellow', 'yellow', 'gray', 'green'] },
  },
];

const MODE_2_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [5, 0, 0, 0],
    feedback: { kind: 'direction', dir: 'lower' },
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [2, 5, 0, 0],
    feedback: { kind: 'direction', dir: 'higher' },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 7, 5, 0],
    feedback: { kind: 'direction', dir: 'higher' },
  },
  {
    side: 'opponent',
    guessIndex: 2,
    digits: [4, 2, 0, 0],
    feedback: { kind: 'direction', dir: 'lower' },
  },
];

const MODE_3_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: { kind: 'precision', plus: 1, minus: 2 },
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [1, 2, 5, 8],
    feedback: { kind: 'precision', plus: 2, minus: 1 },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 2, 7, 6],
    feedback: { kind: 'precision', plus: 2, minus: 2 },
  },
];

const MODE_4_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
    elapsedMs: 8_000,
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [1, 2, 5, 8],
    feedback: { kind: 'colorMatch', states: ['yellow', 'gray', 'gray', 'green'] },
    elapsedMs: 4_000,
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 4, 2, 6],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
    elapsedMs: 11_000,
  },
];

const MODE_5_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: {
      kind: 'blackout',
      states: ['green', 'blackout', 'blackout', 'blackout'],
      locked: 1,
    },
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [1, 2, 5, 8],
    feedback: {
      kind: 'blackout',
      states: ['blackout', 'blackout', 'blackout', 'blackout'],
      locked: 0,
    },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 4, 2, 6],
    feedback: {
      kind: 'blackout',
      states: ['green', 'blackout', 'green', 'blackout'],
      locked: 2,
    },
  },
];

const MODE_6_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
  },
  {
    side: 'opponent',
    guessIndex: 1,
    digits: [1, 2, 5, 8],
    feedback: { kind: 'colorMatch', states: ['yellow', 'gray', 'gray', 'green'] },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 4, 2, 6],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
  },
];

const MODE_7_TIMELINE: readonly GuessEntry[] = [
  {
    side: 'self',
    guessIndex: 1,
    digits: [3, 7, 2, 9],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
  },
  {
    side: 'self',
    guessIndex: 2,
    digits: [3, 4, 2, 6],
    feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
  },
  {
    side: 'self',
    guessIndex: 3,
    digits: [3, 2, 6, 4],
    feedback: { kind: 'colorMatch', states: ['green', 'yellow', 'yellow', 'gray'] },
  },
];

const TIMELINES: Readonly<Record<number, readonly GuessEntry[]>> = {
  1: MODE_1_TIMELINE,
  2: MODE_2_TIMELINE,
  3: MODE_3_TIMELINE,
  4: MODE_4_TIMELINE,
  5: MODE_5_TIMELINE,
  6: MODE_6_TIMELINE,
  7: MODE_7_TIMELINE,
};

export function buildMockTimeline(modeId: number): readonly GuessEntry[] {
  return TIMELINES[modeId] ?? [];
}
