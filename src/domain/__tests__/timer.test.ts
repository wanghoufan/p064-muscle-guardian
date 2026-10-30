import { formatClock, formatDuration, nextVoiceMark, initialVoiceMark } from '../timer';

describe('formatClock', () => {
  it('格式化为 mm:ss 且负数归零', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65000)).toBe('01:05');
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('按分钟/秒组合展示', () => {
    expect(formatDuration(12)).toBe('12秒');
    expect(formatDuration(60)).toBe('1分钟');
    expect(formatDuration(80)).toBe('1分20秒');
  });
});

describe('nextVoiceMark', () => {
  it('倒计时每跨一个剩余整分钟播报一次', () => {
    const text = (m: number) => `还剩${m}分钟`;
    expect(nextVoiceMark('countdown', 180000, 59000, 3, text)).toBeNull();
    const first = nextVoiceMark('countdown', 180000, 61000, 3, text);
    expect(first).toEqual({ mark: 2, text: '还剩2分钟' });
    expect(nextVoiceMark('countdown', 180000, 125000, 2, text)).toEqual({ mark: 1, text: '还剩1分钟' });
    // 同一分钟不重复播报
    expect(nextVoiceMark('countdown', 180000, 130000, 1, text)).toBeNull();
  });

  it('正计时每满一分钟播报一次', () => {
    const text = (m: number) => `已练${m}分钟`;
    expect(nextVoiceMark('free', 0, 59000, 0, text)).toBeNull();
    expect(nextVoiceMark('free', 0, 61000, 0, text)).toEqual({ mark: 1, text: '已练1分钟' });
    expect(nextVoiceMark('free', 0, 121000, 1, text)).toEqual({ mark: 2, text: '已练2分钟' });
  });

  it('初始标记：倒计时取总分钟数，正计时为 0', () => {
    expect(initialVoiceMark('countdown', 180000)).toBe(3);
    expect(initialVoiceMark('free', 0)).toBe(0);
  });
});
