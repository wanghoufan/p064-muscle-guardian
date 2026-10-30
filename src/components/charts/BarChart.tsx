import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { STR } from '../../i18n/strings';
import { Card } from '../ui/Card';

export interface BarRow {
  label: string;
  seconds: number;
}

interface Props {
  rows: BarRow[];
  dense?: boolean;
}

const CHART_H = 120;

/** 柱状图（自绘）：左侧纵坐标（分钟）＋ 三条横向刻度线，0 值保留占位。 */
export function BarChart({ rows, dense }: Props) {
  const { colors } = useTheme();
  const maxSec = Math.max(60, ...rows.map((r) => r.seconds));
  const maxMin = Math.max(5, Math.ceil(maxSec / 60 / 5) * 5);
  const half = Math.round(maxMin / 2);

  return (
    <Card style={styles.card}>
      <View style={styles.chart}>
        <View style={styles.yaxis}>
          <Text style={[styles.yLabel, { color: colors.textSecondary }]}>{maxMin}分</Text>
          <Text style={[styles.yLabel, { color: colors.textSecondary }]}>{half}分</Text>
          <Text style={[styles.yLabel, { color: colors.textSecondary }]}>0</Text>
        </View>
        <View style={styles.plot}>
          {[0, 0.5, 1].map((p) => (
            <View
              key={p}
              style={[
                styles.gridLine,
                p === 1 ? styles.baseLine : null,
                { top: `${p * 100}%`, borderColor: p === 1 ? colors.border : colors.border },
              ]}
            />
          ))}
          <View style={styles.bars}>
            {rows.map((row, i) => {
              const height = row.seconds > 0 ? Math.max(8, (row.seconds / 60 / maxMin) * 100) : 3;
              return (
                <View key={`${row.label}-${i}`} style={styles.barSlot}>
                  <View
                    style={{
                      width: dense ? '100%' : '66%',
                      maxWidth: dense ? undefined : 26,
                      height: `${height}%`,
                      minHeight: 3,
                      backgroundColor: row.seconds > 0 ? colors.primary : colors.track,
                      borderRadius: dense ? 3 : 8,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.xlabels}>
        <View style={styles.yaxisSpacer} />
        <View style={styles.xlabelRow}>
          {rows.map((row, i) => (
            <Text key={`${row.label}-x-${i}`} style={[styles.xLabel, { color: colors.textSecondary }]}>
              {row.label}
            </Text>
          ))}
        </View>
      </View>
      <Text style={[styles.legend, { color: colors.textSecondary }]}>
        {STR.yAxisNote}
        {dense ? STR.xAxisNote30 : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingBottom: 12 },
  chart: { flexDirection: 'row', gap: 8, paddingTop: 6 },
  yaxis: { width: 40, height: CHART_H, justifyContent: 'space-between' },
  yaxisSpacer: { width: 48 },
  yLabel: { fontSize: 14, textAlign: 'right' },
  plot: { flex: 1, height: CHART_H, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  baseLine: { borderTopWidth: 1.5 },
  bars: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  xlabels: { flexDirection: 'row', marginTop: 6 },
  xlabelRow: { flex: 1, flexDirection: 'row', gap: 6 },
  xLabel: { flex: 1, fontSize: 14, textAlign: 'center' },
  legend: { fontSize: 14, marginTop: 6 },
});
