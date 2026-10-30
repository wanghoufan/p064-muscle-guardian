import { parseState, createDefaultState } from '../schema';

describe('parseState', () => {
  it('非对象/损坏数据回退默认状态', () => {
    expect(parseState(null)).toEqual(createDefaultState());
    expect(parseState('bad')).toEqual(createDefaultState());
    expect(parseState({})).toEqual(createDefaultState());
  });

  it('过滤非法训练与测试记录，保留合法记录', () => {
    const state = parseState({
      trainings: [
        { id: 'ok', mode: 'free', seconds: 30, startedAt: 'a', endedAt: 'b' },
        { id: 'bad', mode: 'free', seconds: -1, startedAt: 'a', endedAt: 'b' },
        { id: 'bad2', mode: 'x', seconds: 30, startedAt: 'a', endedAt: 'b' },
      ],
      tests: [
        { id: 'ok', seconds: 40, testedAt: 'a' },
        { id: 'bad', seconds: 'x', testedAt: 'a' },
      ],
      prefs: { themeMode: 'dark', voiceEnabled: false, lastDurationMinutes: 5 },
    });
    expect(state.trainings).toHaveLength(1);
    expect(state.tests).toHaveLength(1);
    expect(state.prefs).toEqual({ themeMode: 'dark', voiceEnabled: false, lastDurationMinutes: 5 });
  });

  it('偏好字段非法时回退安全默认值', () => {
    const state = parseState({ prefs: { themeMode: 'weird', voiceEnabled: 'x', lastDurationMinutes: 0 } });
    expect(state.prefs.themeMode).toBe('system');
    expect(state.prefs.voiceEnabled).toBe(true);
    expect(state.prefs.lastDurationMinutes).toBe(3);
  });
});
