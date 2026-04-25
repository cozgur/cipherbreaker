/**
 * Mode 6 — Sudden Death. Color-match digits plus a `"N/5"` `extra`
 * label showing which guess this is out of the five-guess budget.
 * Lives indicator for remaining guesses lives on the MatchScreen
 * header (player card variant), not inside the row.
 */

import type { GuessRowProps } from '@game/types';
import { GuessRowShell } from './GuessRowShell';

export function Mode6Row(props: GuessRowProps): React.JSX.Element {
  return (
    <GuessRowShell
      side={props.side}
      avatar={props.avatar}
      digits={props.digits}
      extra={props.extra}
    />
  );
}
