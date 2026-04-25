import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
  validateUnique,
} from '../validation';

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
