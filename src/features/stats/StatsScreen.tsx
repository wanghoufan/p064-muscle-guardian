import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/metrics';
import { STR } from '../../i18n/strings';
import { TrainingRecord } from '../../types';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { BarChart } from '../../components/charts/BarChart';
import { dateLabel, lastNDays, sortTrainingsDesc, sumSeconds, todaySummary } from '../../domain/stats';
import { formatDuration } from '../../domain/timer';

interface Props {
  trainings: TrainingRecord[];
}

export function StatsScreen({ trainings }: Props) {
  const { colors, typography } = useTheme();
  const today = todaySummary(trainings);
  const d7 = lastNDays(trainings, 7);
  const d30 = lastNDays(trainings, 30);
  const hasData = trainings.length > 0;
  const history = sortTrainingsDesc(trainings);

  /** 不足 1 分钟按秒展示，避免长辈看到 0 分钟以为没记上。 */
  const amount = (sec: number) =>
    sec > 0 && sec < 60
      ? { value: Math.round(sec), unit: STR.secondsUnit }
      : { value: Math.round(sec / 60), unit: STR.minutesUnit };
  const todayAmount = amount(today.seconds);
  const d7Amount = amount(sumSeconds(d7));
  const d30Amount = amount(sumSeconds(d30));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <SectionTitle>{STR.overview}</SectionTitle>

      <Card style={styles.todayCard}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{STR.todayPractice}</Text>
        <View style={styles.todayValueRow}>
          <Text style={typography.statValue}>{todayAmount.value}</Text>
          <Text style={[styles.unit, { color: colors.textSecondary }]}>{todayAmount.unit}</Text>
          <Text style={[styles.todayCount, { color: colors.textSecondary }]}>{` · ${today.count} 次`}</Text>
        </View>
      </Card>

      <View style={styles.pairRow}>
        <Card style={styles.pairCard}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{STR.last7}</Text>
          <View style={styles.pairValueRow}>
            <Text style={styles.pairValue}>{d7Amount.value}</Text>
            <Text style={[styles.unit, { color: colors.textSecondary }]}>{d7Amount.unit}</Text>
          </View>
        </Card>
        <Card style={styles.pairCard}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{STR.last30}</Text>
          <View style={styles.pairValueRow}>
            <Text style={styles.pairValue}>{d30Amount.value}</Text>
            <Text style={[styles.unit, { color: colors.textSecondary }]}>{d30Amount.unit}</Text>
          </View>
        </Card>
      </View>

      <SectionTitle>{STR.per7}</SectionTitle>
      {hasData ? (
        <BarChart rows={d7.map((d) => ({ label: String(d.date.getDate()), seconds: d.seconds }))} />
      ) : (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{STR.noChartData}</Text>
        </Card>
      )}

      <SectionTitle>{STR.per30}</SectionTitle>
      {hasData ? (
        <BarChart
          dense
          rows={d30.map((d) => ({
            label: d.date.getDate() % 2 === 0 ? String(d.date.getDate()) : '',
            seconds: d.seconds,
          }))}
        />
      ) : (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{STR.noChartData}</Text>
        </Card>
      )}

      <SectionTitle>{STR.history}</SectionTitle>
      {history.length > 0 ? (
        <View style={styles.historyList}>
          {history.map((item) => (
            <Card key={item.id} style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <Text numberOfLines={1} style={[styles.historyDate, { color: colors.textPrimary }]}>
                  {dateLabel(item.endedAt)}
                </Text>
                <Text style={[styles.historyMode, { color: colors.textSecondary }]}>
                  {item.mode === 'countdown' ? STR.modeCountdown : STR.modeFree}
                </Text>
              </View>
              <Text style={[styles.historyDuration, { color: colors.textPrimary }]}>
                {formatDuration(item.seconds)}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{STR.noTrainings}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  todayCard: { gap: spacing.xs },
  todayValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  todayCount: { fontSize: 15, fontWeight: '600', marginLeft: spacing.xs },
  label: { fontSize: 15 },
  unit: { fontSize: 15, fontWeight: '600', marginLeft: spacing.xs },
  pairRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  pairCard: { flex: 1, minWidth: 0 },
  pairValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  pairValue: { fontSize: 34, fontWeight: '800' },
  emptyText: { fontSize: 19 },
  historyList: { gap: spacing.md },
  historyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  historyLeft: { flex: 1, minWidth: 0, gap: 2 },
  historyDate: { fontSize: 19, fontWeight: '700' },
  historyMode: { fontSize: 15 },
  historyDuration: { fontSize: 23, fontWeight: '800' },
});
