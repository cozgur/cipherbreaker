/**
 * Mode 4 — Blitz. Mode 1's ColorMatch evaluator + 10K candidate
 * pool, with a 60-second-per-player chess clock layered on by the
 * UI orchestration in CP3b/c (MatchScreen interval + AppState
 * lifecycle). The mode file itself is *clock-naïve*: it carries
 * neither tick logic nor timeout copy.
 *
 * Why no `mode4/` folder: same reasoning as Mode 6 — the only
 * difference from Mode 1 is `rules.perPlayerTimeLimitMs` (catalog),
 * which the engine + checkEndConditions already honour. Re-exporting
 * `evaluateColorMatch` and Mode 1's bot via a sibling subdirectory
 * was the Phase 3 prediction; at Phase 5 the direct import is
 * shorter and makes the Mode 1 dependency obvious. ARCHITECTURE.md
 * §Phase 5 records the deviation.
 *
 * Constraints (mirror Mode 1):
 *   - **No React import.** Asserted by the grep test in `__tests__/`.
 *   - `evaluate` is pure: same `(guess, secret)` → same feedback.
 *   - `bot.thinkingTime` does NOT consume from `ctx.rng` — UI delay
 *     is decoupled from resume identity (ARCHITECTURE §Phase 3).
 *   - The default 2-12s `thinkingTime` band stays untouched at
 *     Phase 5; SPEC §3.6's clock-aware "panic mode" (faster guesses
 *     when clock < 10s) is a Phase 7A tuning task, not a launch
 *     blocker. The mode file deliberately ships zero clock-aware
 *     bot logic so the bot's behaviour is identical to Mode 1's
 *     until a future evidence-driven tweak.
 */

import { findMode } from '@data/modeCatalog';

import { ModeNotFoundError } from '../errors';
import { buildAllCandidates } from '../shared/candidatePool';
import { generateRandomDigits } from '../shared/secretGeneration';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
} from '../shared/validation';
import type { ModeDefinition, RNG, ValidationResult } from '../types';
import { makeGuess, thinkingTime } from './mode1/bot';
import { evaluateColorMatch, SECRET_LENGTH } from './mode1/evaluate';

const MODE_ID = 4 as const;

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode4Blitz: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, false, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluateColorMatch,
  bot: {
    initSolverState: () => ({ kind: 'candidatePool', pool: buildAllCandidates(false) }),
    makeGuess,
    thinkingTime,
  },
};
