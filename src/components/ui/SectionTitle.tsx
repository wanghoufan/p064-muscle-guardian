import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function SectionTitle({ children }: { children: string }) {
  const { colors, typography } = useTheme();
  return <Text style={[styles.title, typography.section, { color: colors.textPrimary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { marginTop: 16, marginBottom: 8 },
});
