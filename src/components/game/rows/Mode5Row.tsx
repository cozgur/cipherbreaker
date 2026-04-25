/**
 * Mode 5 — Blackout. Digits stay hidden except for locked-in matches
 * (painted green against a blackout sheet). A "N LOCKED" pill sits
 * below the row summarising how many positions locked in this guess.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { GuessRowProps } from '@game/types';
import { colors, fonts } from '@theme/tokens';
import { GuessRowShell } from './GuessRowShell';

export function Mode5Row(props: GuessRowProps): React.JSX.Element {
  const feedback = props.feedback;
  const pill = feedback?.kind === 'blackout' ? <LockedPill locked={feedback.locked} /> : null;

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

interface LockedPillProps {
  readonly locked: number;
}

function LockedPill({ locked }: LockedPillProps): React.JSX.Element {
  const isNone = locked === 0;
  const dotColor = isNone ? colors.textDim : colors.success;
  const labelColor = isNone ? colors.textDim : colors.success;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: dotColor,
            ...(isNone
              ? null
              : {
                  shadowColor: colors.success,
                  shadowOpacity: 1,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 3,
                }),
          },
        ]}
      />
      <Text style={[styles.label, { color: labelColor }]}>
        {isNone ? 'NONE' : `${locked} LOCKED`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
});
