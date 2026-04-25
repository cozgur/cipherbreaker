import { findMode, modeCatalog } from '../modeCatalog';

describe('modeCatalog', () => {
  it('defines exactly seven modes', () => {
    expect(modeCatalog).toHaveLength(7);
  });

  it('has unique ids', () => {
    const ids = new Set(modeCatalog.map((m) => m.id));
    expect(ids.size).toBe(modeCatalog.length);
  });

  it('does not duplicate ids into meta or rules', () => {
    for (const entry of modeCatalog) {
      expect((entry.meta as unknown as { id?: number }).id).toBeUndefined();
      expect((entry.rules as unknown as { id?: number }).id).toBeUndefined();
    }
  });

  it('exposes a non-empty shortLabel on every mode for the Profile grid', () => {
    for (const entry of modeCatalog) {
      expect(entry.meta.shortLabel).toBeTruthy();
      // Single token (no spaces) so narrow tiles never need to truncate.
      expect(entry.meta.shortLabel.includes(' ')).toBe(false);
    }
  });

  it('pairs every mode with one of the seven supported icon keys', () => {
    const allowed = new Set([
      'color-match',
      'high-low',
      'precision',
      'blitz',
      'blackout',
      'sudden-death',
      'mirror',
    ]);
    for (const entry of modeCatalog) {
      expect(allowed.has(entry.meta.iconKey)).toBe(true);
    }
  });

  it('looks up by id', () => {
    const expected = modeCatalog[0];
    expect(expected).toBeDefined();
    if (!expected) return;
    expect(findMode(expected.id)).toBe(expected);
    expect(findMode(999)).toBeUndefined();
  });
});
