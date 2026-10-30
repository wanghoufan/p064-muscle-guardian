import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function TimerText({ value, big }: { value: string; big?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.base,
        big ? typography.timer : typography.timerSmall,
        { color: colors.textPrimary, fontVariant: ['tabular-nums'] },
      ]}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { letterSpacing: -1, textAlign: 'center' },
});
