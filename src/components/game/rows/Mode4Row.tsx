/**
 * Mode 4 — Blitz. Color-match digits plus a pre-formatted elapsed-time
 * `extra` label (`"0:08s"`). The chess clock itself lives on the
 * MatchScreen header cards — the per-row label is a per-guess audit.
 */

import type { GuessRowProps } from '@game/types';
import { GuessRowShell } from './GuessRowShell';

export function Mode4Row(props: GuessRowProps): React.JSX.Element {
  return (
    <GuessRowShell
      side={props.side}
      avatar={props.avatar}
      digits={props.digits}
      extra={props.extra}
    />
  );
}
