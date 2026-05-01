/**
 * Two-option pill segmented toggle. Phase 7A.3 — introduced for the
 * Profile screen's Stats / Settings tab pair, generalised so future
 * two-tab seams (e.g. Daily Challenge "today / streak" pickers) can
 * reuse it without re-rolling the visual.
 *
 * Visuals: 50pt height, 12pt radius, violet-tinted active segment.
 * The active segment is the only one with a fill; the inactive
 * segment shows label-only on the elevated surface. Layout matches
 * the existing `TinyTag` / settings-row visual rhythm.
 *
 * a11y: each segment is `accessibilityRole="tab"` with a
 * `selected` state. The container itself is a `tablist`. Screen
 * readers announce "Stats, tab, 1 of 2, selected" / "Settings, tab,
 * 2 of 2".
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, withAlpha } from '@theme/tokens';
import { fonts } from '@theme/tokens';

export interface SegmentedToggleOption {
  readonly key: string;
  readonly label: string;
}

export interface SegmentedToggleProps {
  readonly options: readonly [SegmentedToggleOption, SegmentedToggleOption];
  readonly value: string;
  readonly onChange: (key: string) => void;
}

export function SegmentedToggle({
  options,
  value,
  onChange,
}: SegmentedToggleProps): React.JSX.Element {
  return (
    <View accessibilityRole="tablist" style={styles.root}>
      {options.map((option, index) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(option.key);
            }}
            style={[
              styles.segment,
              selected && styles.segmentSelected,
              index === 0 ? styles.segmentLeft : styles.segmentRight,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 4,
    height: 50,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentLeft: {
    marginRight: 2,
  },
  segmentRight: {
    marginLeft: 2,
  },
  segmentSelected: {
    backgroundColor: withAlpha(colors.violet, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.violet, 0.35),
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.violet,
  },
});
