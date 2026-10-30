import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { STR } from '../../i18n/strings';
import { Preferences, ThemeMode } from '../../types';
import { Sheet } from '../../components/Sheet';
import { AppButton } from '../../components/ui/AppButton';
import { APP_VERSION } from '../../version';
import { radius, spacing } from '../../theme/metrics';

interface Props {
  visible: boolean;
  onClose: () => void;
  prefs: Preferences;
  onPatch: (patch: Partial<Preferences>) => void;
  trainingCount: number;
  testCount: number;
  onClearTrainings: () => void;
  onClearTests: () => void;
  onClearAll: () => void;
  voiceAvailable?: boolean;
}

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: STR.themeSystem },
  { key: 'light', label: STR.themeLight },
  { key: 'dark', label: STR.themeDark },
];

type ClearTarget = 'trainings' | 'tests' | 'all';

export function SettingsSheet({
  visible,
  onClose,
  prefs,
  onPatch,
  trainingCount,
  testCount,
  onClearTrainings,
  onClearTests,
  onClearAll,
  voiceAvailable = true,
}: Props) {
  const { colors, typography } = useTheme();
  const [pending, setPending] = useState<ClearTarget | null>(null);

  const askText =
    pending === 'trainings' ? STR.clearTrainingsAsk : pending === 'tests' ? STR.clearTestsAsk : STR.clearAllAsk;

  const confirmClear = () => {
    if (pending === 'trainings') onClearTrainings();
    else if (pending === 'tests') onClearTests();
    else if (pending === 'all') onClearAll();
    setPending(null);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={[typography.section, { color: colors.textPrimary, marginBottom: spacing.md }]}>
        {STR.settings}
      </Text>

      <Text style={[typography.small, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
        {STR.appearance}
      </Text>
      <View style={styles.row}>
        {THEMES.map((item) => {
          const on = prefs.themeMode === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: on }}
              onPress={() => onPatch({ themeMode: item.key })}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: on ? colors.primary : colors.surface,
                  borderColor: on ? colors.primary : colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: on ? '#FFFFFF' : colors.textPrimary }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
        <View style={styles.grow}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{STR.voice}</Text>
          {!voiceAvailable ? (
            <Text style={[typography.meta, { color: colors.danger }]}>{STR.voiceUnavailable}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: prefs.voiceEnabled }}
          onPress={() => onPatch({ voiceEnabled: !prefs.voiceEnabled })}
          style={[styles.switchOuter, { backgroundColor: prefs.voiceEnabled ? colors.primary : colors.track }]}
        >
          <View style={[styles.switchKnob, { left: prefs.voiceEnabled ? 27 : 3 }]} />
        </Pressable>
      </View>

      <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>{STR.safety}</Text>
        <Text style={[typography.meta, styles.safetyText, { color: colors.textSecondary }]}>{STR.safetyBody}</Text>
      </View>

      <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>{STR.about}</Text>
        <Text style={[typography.small, { color: colors.textSecondary }]}>
          {STR.version} {APP_VERSION}
        </Text>
      </View>

      <Text style={[typography.small, { color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        {STR.dataSection}
      </Text>

      <View style={[styles.settingRow, { borderTopColor: colors.border, marginTop: 0 }]}>
        <View style={styles.grow}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{STR.clearTrainings}</Text>
          <Text style={[typography.meta, { color: colors.textSecondary }]}>
            {STR.recordsUnit(trainingCount)}
          </Text>
        </View>
        <AppButton
          title={STR.clearAction}
          variant="ghost"
          onPress={() => setPending('trainings')}
          disabled={trainingCount === 0}
        />
      </View>

      <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
        <View style={styles.grow}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{STR.clearTests}</Text>
          <Text style={[typography.meta, { color: colors.textSecondary }]}>{STR.recordsUnit(testCount)}</Text>
        </View>
        <AppButton title={STR.clearAction} variant="ghost" onPress={() => setPending('tests')} disabled={testCount === 0} />
      </View>

      <AppButton
        title={STR.clearAll}
        variant="ghost"
        onPress={() => setPending('all')}
        disabled={trainingCount === 0 && testCount === 0}
        style={{ marginTop: spacing.sm }}
      />

      {pending ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text style={[typography.body, { color: colors.danger }]}>{askText}</Text>
          <Text style={[typography.meta, { color: colors.textSecondary }]}>{STR.clearWarn}</Text>
          <View style={styles.row}>
            <AppButton title={STR.cancel} variant="ghost" onPress={() => setPending(null)} style={styles.grow} />
            <AppButton title={STR.clearConfirmBtn} variant="danger" onPress={confirmClear} style={styles.grow} />
          </View>
        </View>
      ) : null}

      <AppButton title={STR.close} variant="soft" onPress={onClose} style={{ marginTop: spacing.md }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  option: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    marginTop: spacing.sm,
  },
  grow: { flex: 1 },
  safetyText: { flex: 1, textAlign: 'right' },
  switchOuter: { width: 58, height: 34, borderRadius: 17, justifyContent: 'center' },
  switchKnob: { position: 'absolute', top: 3, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF' },
});
