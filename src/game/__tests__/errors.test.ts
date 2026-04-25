import { InvalidEngineStateError, ModeNotFoundError, SolverStateMismatchError } from '../errors';

describe('engine error classes', () => {
  it('ModeNotFoundError carries the offending id and a stable code', () => {
    const err = new ModeNotFoundError(42);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('MODE_NOT_FOUND');
    expect(err.modeId).toBe(42);
    expect(err.message).toContain('42');
    expect(err.name).toBe('ModeNotFoundError');
  });

  it('preserves the original cause when wrapping a lower-level throw', () => {
    const original = new Error('boom');
    const err = new ModeNotFoundError(7, { cause: original });
    expect((err as { cause?: unknown }).cause).toBe(original);
  });

  it('InvalidEngineStateError carries a stable code and freeform message', () => {
    const err = new InvalidEngineStateError('cannot start a completed match');
    expect(err.code).toBe('INVALID_ENGINE_STATE');
    expect(err.message).toBe('cannot start a completed match');
    expect(err).toBeInstanceOf(Error);
  });

  it('SolverStateMismatchError surfaces the kind discrepancy in the message', () => {
    const err = new SolverStateMismatchError('candidatePool', 'mirror');
    expect(err.code).toBe('SOLVER_STATE_MISMATCH');
    expect(err.expected).toBe('candidatePool');
    expect(err.actual).toBe('mirror');
    expect(err.message).toContain('candidatePool');
    expect(err.message).toContain('mirror');
  });

  it('survives instanceof across the prototype chain (TS class extends Error caveat)', () => {
    const err: unknown = new ModeNotFoundError(1);
    expect(err instanceof ModeNotFoundError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
