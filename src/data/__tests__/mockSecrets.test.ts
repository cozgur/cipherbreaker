import { findMode } from '../modeCatalog';
import { mockSecretByMode, secretDigits, secretFor } from '../mockSecrets';

describe('mockSecretByMode', () => {
  it('ships a 4-digit numeric secret for each of the seven modes', () => {
    for (let id = 1; id <= 7; id += 1) {
      const secret = mockSecretByMode[id];
      expect(secret).toBeDefined();
      expect(secret).toMatch(/^\d{4}$/);
    }
  });

  it('respects digitsUnique for the modes that require it', () => {
    for (let id = 1; id <= 7; id += 1) {
      const mode = findMode(id);
      if (!mode) continue;
      // Mode 3 + 5 unique invariant — both flags flipped to true in
      // their respective engine phases (Mode 3 in Phase 4, Mode 5 in
      // Phase 5). The mock secret table obeyed the intended rule from
      // Phase 1B onwards; this test now mostly guards against a
      // catalog regression that would lower the bar.
      if (id === 3 || id === 5) {
        const secret = mockSecretByMode[id]!;
        const set = new Set(secret.split(''));
        expect(set.size).toBe(secret.length);
      }
    }
  });

  it('secretFor falls back to "0000" for an unknown mode', () => {
    expect(secretFor(999)).toBe('0000');
  });

  it('secretDigits returns the digits as numbers in order', () => {
    expect(secretDigits(1)).toEqual([3, 8, 4, 7]);
    expect(secretDigits(7)).toEqual([4, 0, 5, 8]);
  });
});
