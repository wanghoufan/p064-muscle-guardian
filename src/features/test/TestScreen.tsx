import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/metrics';
import { STR } from '../../i18n/strings';
import { TestRecord } from '../../types';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { AppButton } from '../../components/ui/AppButton';
import { TimerText } from '../../components/ui/TimerText';
import { ConfirmModal } from '../../components/ConfirmModal';
import { LineChart } from '../../components/charts/LineChart';
import { useTestSession } from '../../hooks/useTestSession';
import { formatClock, formatDuration } from '../../domain/timer';
import { dateLabel } from '../../domain/stats';

interface Props {
  tests: TestRecord[];
  onTestDone: (seconds: number) => void;
}

const TOAST_MS = 1800;

export function TestScreen(props: Props) {
  const { tests, onTestDone } = props;
  const { colors, typography } = useTheme();

  const [pending, setPending] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const { running, elapsedMs, start, stop } = useTestSession(setPending);

  const last = tests.length > 0 ? tests[tests.length - 1] : null;
  const best = tests.length > 0 ? Math.max(...tests.map((t) => t.seconds)) : null;
  const rows = tests.slice().reverse();

  const timerValue = running
    ? formatClock(elapsedMs)
    : last
      ? formatClock(last.seconds * 1000)
      : '00:00';

  const onConfirmSave = () => {
    if (pending !== null) onTestDone(pending);
    setPending(null);
  };

  const onDiscard = () => {
    setPending(null);
    showToast(STR.discardTest);
  };

  return (
    <View>
      <SectionTitle>{STR.testTitle}</SectionTitle>
      <Text style={[styles.hint, typography.small, { color: colors.textSecondary }]}>{STR.testHint}</Text>

      <Card style={styles.timerCard}>
        <TimerText value={timerValue} big />
        <Text style={[styles.timerCaption, typography.small, { color: colors.textSecondary }]}>
          {running ? STR.testRunning : STR.lastResult}
        </Text>
      </Card>

      <AppButton
        title={running ? STR.testEnd : STR.testStart}
        variant={running ? 'danger' : 'primary'}
        onPress={running ? stop : start}
        style={styles.mainButton}
      />

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statLabel, typography.small, { color: colors.textSecondary }]}>
            {STR.lastResult}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.statValue, styles.statValue, { color: colors.textPrimary }]}
          >
            {last ? formatClock(last.seconds * 1000) : '--:--'}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statLabel, typography.small, { color: colors.textSecondary }]}>
            {STR.bestResult}
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.statValue, styles.statValue, { color: colors.textPrimary }]}
          >
            {best !== null ? formatClock(best * 1000) : '--:--'}
          </Text>
        </Card>
      </View>

      <SectionTitle>{STR.trend}</SectionTitle>
      {tests.length >= 2 ? (
        <LineChart points={tests.map((t) => t.seconds)} />
      ) : (
        <Card>
          <Text style={[styles.emptyText, typography.body, { color: colors.textSecondary }]}>
            {STR.trendNeed}
          </Text>
        </Card>
      )}

      <SectionTitle>{STR.testHistory}</SectionTitle>
      {rows.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, typography.body, { color: colors.textSecondary }]}>
            {STR.noTests}
          </Text>
        </Card>
      ) : (
        rows.map((t) => (
          <Card key={t.id} style={styles.historyCard}>
            <View style={styles.historyLeft}>
              <Text style={[typography.cardTitle, { color: colors.textPrimary }]}>
                {dateLabel(t.testedAt)}
              </Text>
              <Text style={[styles.historySub, typography.small, { color: colors.textSecondary }]}>
                {STR.testTitle}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.historyValue, { color: colors.textPrimary }]}
            >
              {formatClock(t.seconds * 1000)}
            </Text>
          </Card>
        ))
      )}

      {toast ? (
        <Text style={[styles.toast, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
          {toast}
        </Text>
      ) : null}

      <ConfirmModal
        visible={pending !== null}
        title={STR.testQuestion}
        message={pending !== null ? `测试用时 · ${formatDuration(pending)}` : undefined}
        confirmText={STR.doneYes}
        cancelText={STR.doneNo}
        onConfirm={onConfirmSave}
        onCancel={onDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: spacing.md },
  timerCard: { alignItems: 'center', marginTop: spacing.xs },
  timerCaption: { marginTop: spacing.sm },
  mainButton: { marginTop: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  statCard: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md },
  statLabel: { marginBottom: spacing.xs },
  statValue: { fontSize: 28 },
  emptyText: { textAlign: 'center' },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  historyLeft: { flexShrink: 1, marginRight: spacing.md },
  historySub: { marginTop: spacing.xs },
  historyValue: { fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  toast: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 19, textAlign: 'center' },
});
