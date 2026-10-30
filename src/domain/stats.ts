import { TrainingRecord } from '../types';

export interface DayBucket {
  key: string;
  date: Date;
  seconds: number;
}

export function dayKey(input: Date | number | string): string {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 最近 n 天（含今天），按本地日历天分桶累加。 */
export function lastNDays(trainings: TrainingRecord[], n: number, now = new Date()): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    buckets.push({ key: dayKey(d), date: d, seconds: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const t of trainings) {
    const hit = map.get(dayKey(t.endedAt));
    if (hit) hit.seconds += t.seconds;
  }
  return buckets;
}

export function sumSeconds(rows: { seconds: number }[]): number {
  return rows.reduce((acc, r) => acc + r.seconds, 0);
}

export function todaySummary(trainings: TrainingRecord[], now = new Date()) {
  const today = dayKey(now);
  const rows = trainings.filter((t) => dayKey(t.endedAt) === today);
  return { count: rows.length, seconds: sumSeconds(rows) };
}

export function sortTrainingsDesc(trainings: TrainingRecord[]): TrainingRecord[] {
  return [...trainings].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}

export function dateLabel(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  if (key === dayKey(now)) return '今天';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === dayKey(yesterday)) return '昨天';
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
