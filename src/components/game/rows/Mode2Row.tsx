/**
 * Mode 2 — High & Low. Digits render neutral; a Higher/Lower pill
 * sits below the row and colours on the direction (cyan = lower,
 * pink = higher) matching the reference prototype.
 *
 * The pill is suppressed when `feedback.isWin === true`. The Mode 2
 * evaluator must still pick a `dir` value on an exact match (the
 * `direction` feedback union requires it), but rendering an arrow on
 * the winning row would mislead — the timeline shows neutral digits
 * instead, and `MatchResultScreen` handles the celebration.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { GuessRowProps } from '@game/types';
import { colors, fonts, withAlpha } from '@theme/tokens';
import { GuessRowShell } from './GuessRowShell';

export function Mode2Row(props: GuessRowProps): React.JSX.Element {
  const feedback = props.feedback;
  const pill =
    feedback?.kind === 'direction' && feedback.isWin !== true ? (
      <DirectionPill dir={feedback.dir} />
    ) : null;

  return (
    <GuessRowShell
      side={props.side}
      avatar={props.avatar}
      digits={props.digits}
      extra={props.extra}
      below={pill}
    />
  );
}

interface DirectionPillProps {
  readonly dir: 'higher' | 'lower';
}

function DirectionPill({ dir }: DirectionPillProps): React.JSX.Element {
  const color = dir === 'lower' ? colors.cyan : colors.pink;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: withAlpha(color, 0.1),
          borderColor: withAlpha(color, 0.4),
        },
      ]}
    >
      <Text style={[styles.label, { color }]}>{dir === 'lower' ? '▼ Lower' : '▲ Higher'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
});
