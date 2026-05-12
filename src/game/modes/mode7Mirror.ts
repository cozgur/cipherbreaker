/**
 * Mode 7 — Mirror. Same Wordle-style evaluator + 10K candidate pool as
 * Mode 1, but routed through `parallelEngine`: both sides race the
 * **same** engine-generated secret (`flags.sharedSecret`) with no turn
 * rotation and no per-player guess budget. First to crack wins;
 * everything else is composition.
 *
 * Why no `mode7/` folder: Mirror's *only* mechanical differences from
 * Mode 1 are the engine selector (`parallelRace`) and the shared-secret
 * routing skip — both expressed via catalog flags, neither requiring a
 * fresh evaluator or solver. Mirroring the Mode 6 façade pattern keeps
 * the Mode 1 reuse explicit at import time.
 */

import { findMode } from '@data/modeCatalog';

import { ModeNotFoundError } from '../errors';
import { buildAllCandidates } from '../shared/candidatePool';
import { generateRandomDigits } from '../shared/secretGeneration';
import type { BotContext } from '../types';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
} from '../shared/validation';
import type { ModeDefinition, RNG, ValidationResult } from '../types';
import { makeGuess } from './mode1/bot';
import { evaluateColorMatch, SECRET_LENGTH } from './mode1/evaluate';

const MODE_ID = 7 as const;

/**
 * Phase 7A.7 CP8 — Mirror-specific bot pace band. The race-tension
 * deliverable (item 3 in CP8): Mode 1's `thinkingTime` ships a
 * 2-12s band with an 8% chance of a 5-10s "phone-down" outlier
 * extension. That band was tuned for turn-based asymmetric pacing
 * where a 10-second bot turn reads as deliberation. In Mode 7's
 * race context the same band creates 12-17s silent dead spots that
 * actively kill the "rival is your pressure" tension.
 *
 * This wrapper preserves Mode 1's difficulty bands + turn-3 warmup
 * skew (so DDA still modulates pace) and only changes:
 *   - MIN_MS 2000 → 2500: minimum floor stays humanlike. At hard
 *     difficulty's `[0.0, 0.4]` band, the bot still cannot guess
 *     in under 2.5s, which protects user agency on hard.
 *   - MAX_MS 12_000 → 8000: removes the 8-12s upper tail. After
 *     turn-3 warmup the high end is closer to 6.4s; pre-warmup
 *     turns can reach 8s.
 *   - 8% outlier branch dropped entirely. The branch's whole job
 *     was to break the asymmetry of turn-based; race semantics
 *     don't need it and actively suffer from it.
 *
 * Post-warmup bands at the new constants:
 *   easy  : 4.7-6.7s  (was 4.2-9.2s)
 *   normal: 3.6-5.6s  (was 3.2-6.7s)
 *   hard  : 2.5-4.3s  (was 2.0-3.8s; floor RAISED for fairness)
 *
 * Hard is meaningfully not faster than before on the floor — the
 * raised minimum is the user-fairness guarantee. The whole band
 * shifts toward "the bot is always thinking, never spacing out."
 *
 * Logic deliberately duplicated from `mode1/bot.ts` rather than
 * extracted to a shared helper — the two files diverge on purpose
 * here, and a shared 3-param API would obscure the intent at the
 * mode definition sites. ~12 LoC of duplication < 1 shared abstraction.
 */
const MIRROR_THINK_MIN_MS = 2500;
const MIRROR_THINK_MAX_MS = 8000;

export function mirrorThinkingTime(ctx: BotContext): number {
  const span = MIRROR_THINK_MAX_MS - MIRROR_THINK_MIN_MS;
  const bands: Record<BotContext['difficulty'], readonly [number, number]> = {
    easy: [0.4, 1.0],
    normal: [0.2, 0.7],
    hard: [0.0, 0.4],
  };
  const [lowFrac, highFrac] = bands[ctx.difficulty];
  const warmup = ctx.turnNumber <= 3 ? 1.0 : 0.8;
  const low = MIRROR_THINK_MIN_MS + span * lowFrac;
  const high = MIRROR_THINK_MIN_MS + span * highFrac * warmup;
  const value = Math.min(low, high) + Math.random() * Math.abs(high - low);
  return Math.max(MIRROR_THINK_MIN_MS, Math.min(MIRROR_THINK_MAX_MS, Math.round(value)));
}

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode7Mirror: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, false, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluateColorMatch,
  bot: {
    initSolverState: () => ({ kind: 'candidatePool', pool: buildAllCandidates(false) }),
    makeGuess,
    thinkingTime: mirrorThinkingTime,
  },
};
