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
