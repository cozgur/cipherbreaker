/**
 * Mode 3 — Precision. Neutral digits + a trailing `+N  −M` counter
 * rendered beside the digit row (not below, per the reference
 * prototype). `+` counts right-spot hits, `−` counts wrong-spot hits.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { GuessRowProps } from '@game/types';
import { colors, fonts } from '@theme/tokens';
import { GuessRowShell } from './GuessRowShell';

export function Mode3Row(props: GuessRowProps): React.JSX.Element {
  const feedback = props.feedback;
  const counter =
    feedback?.kind === 'precision' ? (
      <PrecisionCounter plus={feedback.plus} minus={feedback.minus} />
    ) : null;

  return (
    <GuessRowShell
      side={props.side}
      avatar={props.avatar}
      digits={props.digits}
      extra={props.extra}
      trailing={counter}
    />
  );
}

interface PrecisionCounterProps {
  readonly plus: number;
  readonly minus: number;
}

function PrecisionCounter({ plus, minus }: PrecisionCounterProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.count, { color: colors.success }]}>+{plus}</Text>
      <Text style={[styles.count, { color: colors.danger }]}>−{minus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 6,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
  },
});
