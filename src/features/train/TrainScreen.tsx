import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Card } from '../../components/ui/Card';
import { AppButton } from '../../components/ui/AppButton';
import { MinuteChip } from '../../components/ui/MinuteChip';
import { TimerText } from '../../components/ui/TimerText';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useTrainingSession, SessionResult } from '../../hooks/useTrainingSession';
import { formatClock, formatDuration, durationLabel } from '../../domain/timer';
import { todaySummary } from '../../domain/stats';
import { STR } from '../../i18n/strings';
import { radius, spacing } from '../../theme/metrics';
import { useTheme } from '../../theme/ThemeContext';
import { Preferences, TrainingMode, TrainingRecord } from '../../types';

interface Props {
  trainings: TrainingRecord[];
  prefs: Preferences;
  onTrainingDone: (r: { seconds: number; mode: TrainingMode; targetSeconds?: number }) => void;
  onPrefsChange: (patch: Partial<Preferences>) => void;
  onImmersiveChange?: (immersive: boolean) => void;
}

const DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DURATION_ROWS = [DURATIONS.slice(0, 5), DURATIONS.slice(5)];
const COUNT_WORDS = [STR.countThree, STR.countTwo, STR.countOne, STR.countGo];

export function TrainScreen(props: Props) {
  const { trainings, prefs, onTrainingDone, onPrefsChange, onImmersiveChange } = props;
  const { colors, typography } = useTheme();
  const { width } = useWindowDimensions();

  const [pending, setPending] = useState<SessionResult | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleComplete = useCallback((result: SessionResult) => {
    setPending(result);
  }, []);

  const { phase, mode, countStep, remainingMs, startCountdown, startFree, cancel, pause, resume, endNow } =
    useTrainingSession({ onComplete: handleComplete });

  useEffect(() => {
    onImmersiveChange?.(phase !== 'idle');
  }, [phase, onImmersiveChange]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 1800);
  }, []);

  const today = todaySummary(trainings);

  const handlePick = (minutes: number) => {
    startCountdown(minutes);
    onPrefsChange({ lastDurationMinutes: minutes });
  };

  const handleConfirm = () => {
    if (pending) {
      const result: { seconds: number; mode: TrainingMode; targetSeconds?: number } = {
        seconds: pending.seconds,
        mode: pending.mode,
      };
      if (pending.mode === 'countdown' && pending.targetSeconds !== undefined) {
        result.targetSeconds = pending.targetSeconds;
      }
      onTrainingDone(result);
    }
    setPending(null);
  };

  const handleCancelDone = () => {
    setPending(null);
    showToast(STR.discardTrain);
  };

  const immersive = phase === 'running' || phase === 'paused';
  const counterLabel = mode === 'countdown' ? STR.runningCountdownLabel : STR.runningFreeLabel;
  const clock = formatClock(remainingMs);
  const countWord = countStep >= 0 && countStep < COUNT_WORDS.length ? COUNT_WORDS[countStep] : '';
  const confirmMessage = pending
    ? `${pending.mode === 'countdown' ? STR.modeCountdown : STR.modeFree} · ${formatDuration(pending.seconds)}`
    : '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {immersive ? (
        <View style={styles.immersive}>
          <Card style={styles.timerCard}>
            <Text style={[typography.small, styles.timerLabel]}>{counterLabel}</Text>
            {width < 360 ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[typography.timer, styles.timerCompact]}
              >
                {clock}
              </Text>
            ) : (
              <TimerText value={clock} big />
            )}
          </Card>
          <View style={styles.immersiveActions}>
            {phase === 'running' ? (
              <AppButton title={STR.pause} variant="ghost" onPress={pause} style={styles.immersiveButton} />
            ) : (
              <AppButton title={STR.resume} variant="soft" onPress={resume} style={styles.immersiveButton} />
            )}
            <AppButton title={STR.end} variant="danger" onPress={endNow} style={styles.immersiveButton} />
          </View>
          <Text style={[typography.small, styles.endHint]}>{STR.endHint}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.todayCard}>
            <Text style={[typography.meta, styles.todayLabel]}>{STR.today}</Text>
            <Text style={[typography.statValue, styles.todayValue]}>
              {STR.todayUnit(today.count, durationLabel(today.seconds))}
            </Text>
          </Card>

          <SectionTitle>{STR.countdownSection}</SectionTitle>
          <Text style={[typography.small, styles.hint]}>{STR.countdownHint}</Text>
          {DURATION_ROWS.map((row) => (
            <View key={row[0]} style={styles.chipRow}>
              {row.map((minutes) => (
                <MinuteChip
                  key={minutes}
                  minutes={minutes}
                  selected={prefs.lastDurationMinutes === minutes}
                  onPress={() => handlePick(minutes)}
                />
              ))}
            </View>
          ))}

          <SectionTitle>{STR.freeSection}</SectionTitle>
          <Card>
            <View style={styles.freeRow}>
              <TimerText value="00:00" />
              <Text style={[typography.small, styles.freeHint]}>{STR.freeHint}</Text>
            </View>
            <View style={styles.freeSpacer} />
            <AppButton title={STR.startFree} onPress={startFree} />
          </Card>

          <AppButton
            title={STR.safety}
            variant="ghost"
            onPress={() => setSafetyOpen((open) => !open)}
            style={styles.safetyButton}
          />
          {safetyOpen ? (
            <Card style={styles.safetyCard}>
              <Text style={[typography.body, styles.safetyBody]}>{STR.safetyBody}</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}

      {phase === 'counting' ? (
        <View style={[styles.countOverlay, { backgroundColor: colors.overlay }]}>
          <Text style={styles.countWord}>{countWord}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={cancel}
            style={({ pressed }) => [styles.countCancel, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.countCancelText}>{STR.cancel}</Text>
          </Pressable>
        </View>
      ) : null}

      {toastText ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Text style={[typography.small, styles.toastText, { color: colors.textPrimary }]}>{toastText}</Text>
        </View>
      ) : null}

      <ConfirmModal
        visible={pending !== null}
        title={STR.doneQuestion}
        message={confirmMessage}
        confirmText={STR.doneYes}
        cancelText={STR.doneNo}
        onConfirm={handleConfirm}
        onCancel={handleCancelDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  todayCard: { marginTop: spacing.sm },
  todayLabel: { marginBottom: spacing.xs },
  todayValue: { letterSpacing: -0.5 },
  hint: { marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  freeRow: { flexDirection: 'row', alignItems: 'center' },
  freeHint: { flex: 1, marginLeft: spacing.md },
  freeSpacer: { height: spacing.md },
  safetyButton: { marginTop: spacing.md },
  safetyCard: { marginTop: spacing.sm },
  safetyBody: { lineHeight: 28 },
  immersive: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: 'center',
  },
  timerCard: { alignItems: 'center', paddingVertical: spacing.xl },
  timerLabel: { marginBottom: spacing.sm },
  timerCompact: { fontSize: 72 },
  immersiveActions: { gap: spacing.md, marginTop: spacing.xl },
  immersiveButton: { width: '100%' },
  endHint: { marginTop: spacing.md, textAlign: 'center' },
  countOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 20,
  },
  countWord: {
    fontSize: 96,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#FFFFFF',
    marginBottom: spacing.xl,
  },
  countCancel: {
    minHeight: 48,
    minWidth: 140,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: radius.control,
  },
  countCancelText: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 80,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  toastText: { textAlign: 'center' },
});
