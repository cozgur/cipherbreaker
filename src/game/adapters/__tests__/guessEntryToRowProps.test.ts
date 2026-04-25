import type { GuessEntry, GuessRowAdaptorContext } from '../../types';
import { guessEntryToRowProps } from '../guessEntryToRowProps';

const ctx: GuessRowAdaptorContext = {
  selfAvatar: 'Nova',
  opponentAvatar: 'Shadow',
  modeId: 1,
};

describe('guessEntryToRowProps', () => {
  it("maps self → 'left' and paints with colorMatch states", () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [3, 7, 2, 9],
      feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
    };
    const row = guessEntryToRowProps(entry, ctx);
    expect(row.side).toBe('left');
    expect(row.avatar).toBe('Nova');
    expect(row.digits).toEqual([
      { val: 3, state: 'green' },
      { val: 7, state: 'gray' },
      { val: 2, state: 'yellow' },
      { val: 9, state: 'gray' },
    ]);
  });

  it("maps opponent → 'right' and flips the avatar", () => {
    const entry: GuessEntry = {
      side: 'opponent',
      guessIndex: 1,
      digits: [1, 2, 3, 4],
      feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'green'] },
    };
    const row = guessEntryToRowProps(entry, ctx);
    expect(row.side).toBe('right');
    expect(row.avatar).toBe('Shadow');
  });

  it('uses neutral digit states for direction feedback (Mode 2)', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [5, 0, 0, 0],
      feedback: { kind: 'direction', dir: 'lower' },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 2 });
    expect(row.digits.every((d) => d.state === 'neutral')).toBe(true);
    expect(row.feedback).toEqual({ kind: 'direction', dir: 'lower' });
  });

  it('uses neutral digit states for precision feedback (Mode 3)', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [3, 7, 2, 9],
      feedback: { kind: 'precision', plus: 1, minus: 2 },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 3 });
    expect(row.digits.every((d) => d.state === 'neutral')).toBe(true);
    expect(row.extra).toBeUndefined();
  });

  it('formats elapsed ms as the extra label in Mode 4 (Blitz)', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [3, 7, 2, 9],
      feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
      elapsedMs: 8_400,
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 4 });
    expect(row.extra).toBe('0:08s');
  });

  it('drops the extra label in Mode 4 when elapsedMs is missing', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [3, 7, 2, 9],
      feedback: { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'] },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 4 });
    expect(row.extra).toBeUndefined();
  });

  it('paints blackout digits and forwards the locked count (Mode 5)', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 1,
      digits: [3, 7, 2, 9],
      feedback: {
        kind: 'blackout',
        states: ['green', 'blackout', 'blackout', 'blackout'],
        locked: 1,
      },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 5 });
    expect(row.digits.map((d) => d.state)).toEqual(['green', 'blackout', 'blackout', 'blackout']);
    expect(row.feedback).toEqual({
      kind: 'blackout',
      states: ['green', 'blackout', 'blackout', 'blackout'],
      locked: 1,
    });
  });

  it('formats Mode 6 Sudden Death extra as N/5', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 3,
      digits: [3, 4, 2, 6],
      feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 6 });
    expect(row.extra).toBe('3/5');
  });

  it('keeps feedback untouched for non-extra modes (Mode 7 Mirror)', () => {
    const entry: GuessEntry = {
      side: 'self',
      guessIndex: 2,
      digits: [3, 4, 2, 6],
      feedback: { kind: 'colorMatch', states: ['green', 'gray', 'green', 'yellow'] },
    };
    const row = guessEntryToRowProps(entry, { ...ctx, modeId: 7 });
    expect(row.extra).toBeUndefined();
    expect(row.feedback?.kind).toBe('colorMatch');
  });
});
