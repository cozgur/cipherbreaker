/**
 * Mode 1 — Color Match. Standard Wordle-style row: digits painted
 * green/yellow/gray via `feedback.kind === 'colorMatch'`. No extra
 * chip; per-digit state carries every hint.
 */

import type { GuessRowProps } from '@game/types';
import { GuessRowShell } from './GuessRowShell';

export function Mode1Row(props: GuessRowProps): React.JSX.Element {
  return (
    <GuessRowShell
      side={props.side}
      avatar={props.avatar}
      digits={props.digits}
      extra={props.extra}
    />
  );
}
