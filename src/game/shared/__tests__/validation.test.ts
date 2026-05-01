import {
  composeValidators,
  ERROR_NOT_DIGITS,
  ERROR_NOT_UNIQUE,
  ERROR_WRONG_LENGTH,
  validateDigitsOnly,
  validateLength,
  validateUnique,
} from '../validation';

// SPEC §UI: every error message surfaced to the player ships in
// English. The Phase 4 audit caught a Turkish "Tüm basamaklar farklı
// olmalı." leaking into the MatchScreen inline error while
// SecretSetup hardcoded the English version. These constants are now
// the single source for both surfaces — the regex below makes a
// future Turkish-string regression obvious.
const ASCII_LETTERS_AND_PUNCT = /^[\x20-\x7e]+$/;

describe('error messages — English single source (no Turkish leakage)', () => {
  it.each([
    ['ERROR_WRONG_LENGTH(4)', ERROR_WRONG_LENGTH(4), 'Guess must be 4 digits.'],
    ['ERROR_NOT_DIGITS', ERROR_NOT_DIGITS, 'Use digits 0-9 only.'],
    ['ERROR_NOT_UNIQUE', ERROR_NOT_UNIQUE, 'All digits must be unique'],
  ])('%s is the canonical English copy', (_label, actual, expected) => {
    expect(actual).toBe(expected);
    expect(actual).toMatch(ASCII_LETTERS_AND_PUNCT);
  });
});

describe('atomic validators', () => {
  it('validateLength', () => {
    const check = validateLength(4);
    expect(check('1234')).toEqual({ ok: true });
    const fail = check('123');
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error.code).toBe('WRONG_LENGTH');
  });

  it('validateDigitsOnly', () => {
    expect(validateDigitsOnly('1234')).toEqual({ ok: true });
    const fail = validateDigitsOnly('12a4');
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error.code).toBe('NOT_DIGITS');
  });

  it('validateUnique', () => {
    expect(validateUnique('1234')).toEqual({ ok: true });
    const fail = validateUnique('1224');
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error.code).toBe('NOT_UNIQUE');
  });
});

describe('composeValidators', () => {
  const fullChain = composeValidators(validateLength(4), validateDigitsOnly, validateUnique);

  it('returns ok when every validator passes', () => {
    expect(fullChain('1234')).toEqual({ ok: true });
  });

  it('returns the first failure (length check before digit check)', () => {
    const r = fullChain('12a');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('returns digit failure when length is correct but content is not', () => {
    const r = fullChain('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });

  it('returns unique failure last in the chain', () => {
    const r = fullChain('1224');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_UNIQUE');
  });

  it('empty composition is always ok', () => {
    const noop = composeValidators();
    expect(noop('anything')).toEqual({ ok: true });
  });
});

// Phase 7A.4 CP1 — variable digit count infrastructure audit.
// Daily Challenge ships at 4 / 5 / 6 digits; the validators must
// already accept any positive length (no Mode-1-7 hardcode). This
// suite is the regression guard: a future "let's collapse the length
// arg back to a constant" cleanup PR fails here loudly.
describe('length-agnosticism — Daily Challenge infrastructure (3 → 8 digit sweep)', () => {
  it.each([3, 4, 5, 6, 7, 8])(
    'validateLength(%i) accepts a string of that length and rejects others',
    (length) => {
      const check = validateLength(length);
      const exact = '1'.repeat(length);
      const tooShort = '1'.repeat(length - 1);
      const tooLong = '1'.repeat(length + 1);
      expect(check(exact)).toEqual({ ok: true });
      expect(check(tooShort).ok).toBe(false);
      expect(check(tooLong).ok).toBe(false);
    },
  );

  it.each([
    [3, '123'],
    [4, '1234'],
    [5, '12345'],
    [6, '123456'],
    [7, '1234567'],
    [8, '12345678'],
  ])(
    'validateDigitsOnly accepts %i-digit strings and rejects letter contamination',
    (_length, sample) => {
      expect(validateDigitsOnly(sample)).toEqual({ ok: true });
      // Replace the last char with a letter — must fail at any length.
      const corrupted = `${sample.slice(0, -1)}a`;
      expect(validateDigitsOnly(corrupted).ok).toBe(false);
    },
  );

  it.each([
    [3, '123', '112'],
    [4, '1234', '1224'],
    [5, '12345', '12342'],
    [6, '123456', '123451'],
    [7, '1234567', '1234561'],
    [8, '12345678', '12345671'],
  ])('validateUnique grades unique vs duplicate at length %i', (_length, allUnique, withDupe) => {
    expect(validateUnique(allUnique)).toEqual({ ok: true });
    expect(validateUnique(withDupe).ok).toBe(false);
  });

  it.each([3, 4, 5, 6, 7, 8])(
    'composed chain (length + digits + unique) accepts canonical input at length %i',
    (length) => {
      // Build an ascending-digit string of the requested length,
      // capped at 9 (keeps each digit distinct → unique passes).
      const sample = Array.from({ length }, (_, i) => String(i + 1)).join('');
      const chain = composeValidators(validateLength(length), validateDigitsOnly, validateUnique);
      expect(chain(sample)).toEqual({ ok: true });
    },
  );
});
