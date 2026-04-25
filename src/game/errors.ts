/**
 * Engine-layer error classes. Per ROADMAP §Hata Stratejisi these are
 * thrown only for *architectural* failures — code paths that should
 * never execute in a healthy build. User-input failures use the
 * `ValidationResult` return type instead and never throw.
 *
 * Each class carries:
 *   - `code` — stable string for programmatic dispatch (analytics, dev
 *     overlay) without parsing the human-readable message.
 *   - default `message` — what bubbles to the dev console / red box.
 *   - optional `cause` — original error preserved through the chain
 *     when wrapping a lower-level throw (e.g. AsyncStorage hydration).
 */

interface EngineErrorOptions {
  readonly cause?: unknown;
}

abstract class EngineError extends Error {
  abstract readonly code: string;

  protected constructor(message: string, options?: EngineErrorOptions) {
    super(message);
    this.name = new.target.name;
    if (options?.cause !== undefined) {
      // Match ES2022 Error.cause without requiring the lib target tweak.
      (this as { cause?: unknown }).cause = options.cause;
    }
    // Restore prototype chain after extending Error (TS/Node interop).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Mode id passed to the registry has no registered ModeDefinition. */
export class ModeNotFoundError extends EngineError {
  readonly code = 'MODE_NOT_FOUND' as const;
  readonly modeId: number;

  constructor(modeId: number, options?: EngineErrorOptions) {
    super(`Mode ${modeId} is not registered`, options);
    this.modeId = modeId;
  }
}

/** Engine invoked on a MatchState whose phase makes the operation invalid. */
export class InvalidEngineStateError extends EngineError {
  readonly code = 'INVALID_ENGINE_STATE' as const;

  constructor(message: string, options?: EngineErrorOptions) {
    super(message, options);
  }
}

/** Bot solver returned a SolverState whose `kind` doesn't match the mode. */
export class SolverStateMismatchError extends EngineError {
  readonly code = 'SOLVER_STATE_MISMATCH' as const;
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string, options?: EngineErrorOptions) {
    super(`Solver state kind mismatch — expected '${expected}', got '${actual}'`, options);
    this.expected = expected;
    this.actual = actual;
  }
}
