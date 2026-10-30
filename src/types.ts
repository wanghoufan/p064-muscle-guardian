export type TrainingMode = 'countdown' | 'free';

export interface TrainingRecord {
  id: string;
  mode: TrainingMode;
  /** 倒计时模式的目标秒数；自由计时为空 */
  targetSeconds?: number;
  /** 实际完成秒数 */
  seconds: number;
  startedAt: string;
  endedAt: string;
}

export interface TestRecord {
  id: string;
  seconds: number;
  testedAt: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Preferences {
  themeMode: ThemeMode;
  voiceEnabled: boolean;
  /** 上次选的倒计时档位（分钟），仅用于高亮 */
  lastDurationMinutes: number;
}

export interface PersistedState {
  schemaVersion: 1;
  trainings: TrainingRecord[];
  tests: TestRecord[];
  prefs: Preferences;
}

export type TabKey = 'train' | 'test' | 'stats';
