import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../ui/Card';
import { formatClock } from '../../domain/timer';

interface Props {
  /** 每次测试的秒数，按时间正序 */
  points: number[];
}

const H = 150;
const PAD_L = 46;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 20;

/** 折线图（自绘）：纵轴刻度 + 折线 + 数据点。 */
export function LineChart({ points }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  const maxV = Math.max(...points);
  const minV = Math.min(...points);
  const span = Math.max(15, maxV - minV);
  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const coords = points.map((sec, i) => {
    const x = PAD_L + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
    const y = PAD_T + plotH * (1 - (sec - minV) / span);
    return { x, y };
  });

  return (
    <Card style={styles.card} >
      <View onLayout={onLayout} style={{ height: H }}>
        {[0, 0.5, 1].map((p) => (
          <View
            key={`g-${p}`}
            style={[
              styles.grid,
              { top: PAD_T + plotH * p, left: PAD_L, right: PAD_R, borderColor: colors.border },
            ]}
          />
        ))}
        <Text style={[styles.yLabel, { top: PAD_T - 8, color: colors.textSecondary }]}>
          {formatClock(maxV * 1000)}
        </Text>
        <Text style={[styles.yLabel, { top: PAD_T + plotH / 2 - 8, color: colors.textSecondary }]}>
          {formatClock(((maxV + minV) / 2) * 1000)}
        </Text>
        <Text style={[styles.yLabel, { top: PAD_T + plotH - 8, color: colors.textSecondary }]}>
          {formatClock(minV * 1000)}
        </Text>
        {coords.slice(0, -1).map((p, i) => {
          const q = coords[i + 1];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          return (
            <View
              key={`seg-${i}`}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y - 1.5,
                width: len,
                height: 3,
                backgroundColor: colors.primary,
                borderRadius: 2,
                transform: [{ rotate: `${angle}rad` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}
        {coords.map((p, i) => (
          <View
            key={`dot-${i}`}
            style={{
              position: 'absolute',
              left: p.x - 5,
              top: p.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.primary,
            }}
          />
        ))}
      </View>
      <Text style={[styles.legend, { color: colors.textSecondary }]}>
        纵轴：测试用时（分:秒），共 {points.length} 次
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 10, paddingBottom: 8 },
  grid: { position: 'absolute', borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  yLabel: { position: 'absolute', left: 0, width: PAD_L - 6, fontSize: 13, textAlign: 'right' },
  legend: { fontSize: 14, marginTop: 2 },
});
