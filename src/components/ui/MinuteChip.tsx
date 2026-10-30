import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/metrics';

interface Props {
  minutes: number;
  selected?: boolean;
  onPress: () => void;
}

export function MinuteChip({ minutes, selected, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${minutes}分钟`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Text style={[styles.value, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{minutes}</Text>
      <Text style={[styles.unit, { color: selected ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
        分钟
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 56,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 19, fontWeight: '700', lineHeight: 22 },
  unit: { fontSize: 13, lineHeight: 16 },
});
