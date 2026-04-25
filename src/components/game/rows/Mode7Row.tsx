/**
 * Mode 7 — Mirror (solo race). Both players solve the same code in
 * parallel; the MatchScreen only renders the local player's timeline,
 * so every row forces `side='left'` regardless of what the adaptor
 * produces. Opponent progress is surfaced via a header indicator, not
 * as rows.
 */

import type { GuessRowProps } from '@game/types';
import { GuessRowShell } from './GuessRowShell';

export function Mode7Row(props: GuessRowProps): React.JSX.Element {
  return (
    <GuessRowShell side="left" avatar={props.avatar} digits={props.digits} extra={props.extra} />
  );
}
