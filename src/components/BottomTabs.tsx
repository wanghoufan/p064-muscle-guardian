import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { STR } from '../i18n/strings';
import { TabKey } from '../types';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'train', label: STR.tabTrain },
  { key: 'test', label: STR.tabTest },
  { key: 'stats', label: STR.tabStats },
];

function TabIcon({ kind, color }: { kind: TabKey; color: string }) {
  if (kind === 'train') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.dumbbellBar, { backgroundColor: color }]} />
        <View style={[styles.dumbbellEnd, { backgroundColor: color }]} />
        <View style={[styles.dumbbellEnd, { backgroundColor: color }]} />
      </View>
    );
  }
  if (kind === 'test') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.clock, { borderColor: color }]}>
          <View style={[styles.hand, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.iconBox}>
      <View style={styles.barsRow}>
        <View style={[styles.barIcon, { height: 8, backgroundColor: color }]} />
        <View style={[styles.barIcon, { height: 14, backgroundColor: color }]} />
        <View style={[styles.barIcon, { height: 10, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function BottomTabs({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        const color = on ? colors.primary : colors.textSecondary;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: on ? colors.primarySoft : 'transparent', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <TabIcon kind={tab.key} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 58,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 10,
    gap: 4,
    borderTopWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 1 },
  label: { fontSize: 15, fontWeight: '600', lineHeight: 18 },
  iconBox: { width: 20, height: 18, alignItems: 'center', justifyContent: 'center' },
  dumbbellBar: { position: 'absolute', width: 16, height: 3, borderRadius: 2 },
  dumbbellEnd: { position: 'absolute', width: 3, height: 10, borderRadius: 2, left: 1 },
  clock: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', paddingTop: 2 },
  hand: { width: 1.5, height: 6, borderRadius: 1, transform: [{ rotate: '20deg' }] },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barIcon: { width: 3, borderRadius: 1 },
});
