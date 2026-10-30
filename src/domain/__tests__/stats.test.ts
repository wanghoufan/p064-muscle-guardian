import { dayKey, lastNDays, sumSeconds, todaySummary, sortTrainingsDesc, dateLabel } from '../stats';
import { TrainingRecord } from '../../types';

function makeRecord(endedAt: Date, seconds: number, id = 'x'): TrainingRecord {
  return {
    id,
    mode: 'countdown',
    targetSeconds: seconds,
    seconds,
    startedAt: new Date(endedAt.getTime() - seconds * 1000).toISOString(),
    endedAt: endedAt.toISOString(),
  };
}

describe('stats', () => {
  const now = new Date(2026, 9, 30, 20, 0, 0); // 2026-10-30 本地时间

  it('dayKey 用本地日历天', () => {
    expect(dayKey(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
    expect(dayKey(new Date(2026, 9, 31, 0, 1))).toBe('2026-10-31');
  });

  it('lastNDays 分桶累计且含今天', () => {
    const records = [
      makeRecord(new Date(2026, 9, 30, 19, 0), 180, 'a'),
      makeRecord(new Date(2026, 9, 30, 8, 0), 120, 'b'),
      makeRecord(new Date(2026, 9, 29, 19, 0), 60, 'c'),
      makeRecord(new Date(2026, 9, 1, 19, 0), 60, 'd'), // 超出 7 天
    ];
    const d7 = lastNDays(records, 7, now);
    expect(d7).toHaveLength(7);
    expect(d7[6].key).toBe('2026-10-30');
    expect(d7[6].seconds).toBe(300);
    expect(d7[5].seconds).toBe(60);
    expect(sumSeconds(d7)).toBe(360);
  });

  it('todaySummary 统计次数与秒数', () => {
    const records = [makeRecord(new Date(2026, 9, 30, 19, 0), 180, 'a'), makeRecord(new Date(2026, 9, 29, 19, 0), 60, 'b')];
    expect(todaySummary(records, now)).toEqual({ count: 1, seconds: 180 });
  });

  it('sortTrainingsDesc 按结束时间倒序', () => {
    const a = makeRecord(new Date(2026, 9, 29, 19, 0), 60, 'a');
    const b = makeRecord(new Date(2026, 9, 30, 19, 0), 60, 'b');
    expect(sortTrainingsDesc([a, b]).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('dateLabel 今天/昨天/日期', () => {
    expect(dateLabel(new Date(2026, 9, 30, 12).toISOString(), now)).toBe('今天');
    expect(dateLabel(new Date(2026, 9, 29, 12).toISOString(), now)).toBe('昨天');
    expect(dateLabel(new Date(2026, 9, 20, 12).toISOString(), now)).toBe('10月20日');
  });
});
