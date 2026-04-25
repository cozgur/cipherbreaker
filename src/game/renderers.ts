/**
 * Dispatch map from mode id → guess row component. MatchScreen calls
 * `getRowRenderer(modeId)` for every entry in the timeline — each row
 * component knows how to paint its own mode's feedback chip + digit
 * states. Adding a mode is three files + one registry entry here.
 *
 * Phase 2 wires engines to emit `GuessEntry`s; the renderer layer and
 * mode catalog never learn about engine internals.
 */

import type { ComponentType } from 'react';

import {
  Mode1Row,
  Mode2Row,
  Mode3Row,
  Mode4Row,
  Mode5Row,
  Mode6Row,
  Mode7Row,
} from '@components/game/rows';
import type { GuessRowProps } from './types';

export type GuessRowComponent = ComponentType<GuessRowProps>;

export const guessRowRenderers: Readonly<Record<number, GuessRowComponent>> = {
  1: Mode1Row,
  2: Mode2Row,
  3: Mode3Row,
  4: Mode4Row,
  5: Mode5Row,
  6: Mode6Row,
  7: Mode7Row,
};

/** Lookup with `noUncheckedIndexedAccess` in mind. */
export function getRowRenderer(modeId: number): GuessRowComponent | undefined {
  return guessRowRenderers[modeId];
}
