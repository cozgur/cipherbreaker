/**
 * Internal layout scaffold shared by every `Mode{N}Row`. Handles:
 *   - side alignment (left/right of the timeline)
 *   - avatar placement
 *   - the `extra` sublabel (e.g. "0:08s", "3/5")
 *   - the digit tile row
 *
 * Not exported from the rows barrel — only the seven `Mode{N}Row`
 * components consume it. Each row composes the shell and adds its
 * mode-specific chip via `trailing` (rendered beside digits — used by
 * Mode 3) or `below` (rendered under digits — used by Modes 2 and 5).
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@components/Avatar';
import { DigitTile } from '@components/DigitTile';
import type { DigitTileVisualState } from '@game/types';
import { colors } from '@theme/tokens';
import { typography } from '@theme/typography';

export interface GuessRowShellProps {
  readonly side: 'left' | 'right';
  readonly avatar: string;
  readonly digits: ReadonlyArray<{ val: number; state: DigitTileVisualState }>;
  readonly extra?: string;
  readonly trailing?: ReactNode;
  readonly below?: ReactNode;
}

const DIGIT_SIZE = 36;

export function GuessRowShell({
  side,
  avatar,
  digits,
  extra,
  trailing,
  below,
}: GuessRowShellProps): React.JSX.Element {
  const alignSelf = side === 'left' ? 'flex-start' : 'flex-end';
  const flexDirection = side === 'left' ? 'row' : 'row-reverse';
  const textAlign = side === 'left' ? 'left' : 'right';

  return (
    <View style={[styles.row, { alignSelf }]}>
      <View style={[styles.bubble, { flexDirection }]}>
        <Avatar name={avatar} size={22} />
        <View style={styles.stack}>
          {extra != null && extra.length > 0 ? (
            <Text style={[styles.extra, { textAlign }]}>{extra}</Text>
          ) : null}
          <View style={styles.digitRow}>
            {digits.map((d, i) => (
              <DigitTile key={i} digit={d.val} state={d.state} size={DIGIT_SIZE} />
            ))}
            {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
          </View>
          {below != null ? (
            <View
              style={[styles.below, { alignItems: side === 'left' ? 'flex-start' : 'flex-end' }]}
            >
              {below}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
    maxWidth: '92%',
  },
  bubble: {
    alignItems: 'center',
    gap: 8,
  },
  stack: {
    gap: 4,
  },
  extra: {
    ...typography.tiny,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textDim,
    marginBottom: 2,
  },
  digitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trailing: {
    marginLeft: 8,
  },
  below: {
    marginTop: 6,
  },
});
