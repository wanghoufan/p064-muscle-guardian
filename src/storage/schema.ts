import { PersistedState, Preferences, ThemeMode, TrainingRecord, TestRecord } from '../types';

export const STORAGE_KEY = 'muscle-keeper/state';
export const SCHEMA_VERSION = 1 as const;

export const DEFAULT_PREFS: Preferences = {
  themeMode: 'system',
  voiceEnabled: true,
  lastDurationMinutes: 3,
};

export function createDefaultState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, trainings: [], tests: [], prefs: { ...DEFAULT_PREFS } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function validTraining(v: unknown): v is TrainingRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    (v.mode === 'countdown' || v.mode === 'free') &&
    typeof v.seconds === 'number' && Number.isFinite(v.seconds) && v.seconds > 0 &&
    typeof v.startedAt === 'string' &&
    typeof v.endedAt === 'string'
  );
}

function validTest(v: unknown): v is TestRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.seconds === 'number' && Number.isFinite(v.seconds) && v.seconds > 0 &&
    typeof v.testedAt === 'string'
  );
}

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

function sanitizePrefs(v: unknown): Preferences {
  if (!isRecord(v)) return { ...DEFAULT_PREFS };
  const themeMode = THEME_MODES.includes(v.themeMode as ThemeMode)
    ? (v.themeMode as ThemeMode)
    : DEFAULT_PREFS.themeMode;
  const last = typeof v.lastDurationMinutes === 'number' && v.lastDurationMinutes >= 1 && v.lastDurationMinutes <= 10
    ? Math.round(v.lastDurationMinutes)
    : DEFAULT_PREFS.lastDurationMinutes;
  return {
    themeMode,
    voiceEnabled: typeof v.voiceEnabled === 'boolean' ? v.voiceEnabled : true,
    lastDurationMinutes: last,
  };
}

/** 解析持久化数据：任何非法/损坏一律安全回退，不白屏、不崩溃。 */
export function parseState(raw: unknown): PersistedState {
  if (!isRecord(raw)) return createDefaultState();
  const trainings = Array.isArray(raw.trainings) ? raw.trainings.filter(validTraining) : [];
  const tests = Array.isArray(raw.tests) ? raw.tests.filter(validTest) : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    trainings,
    tests,
    prefs: sanitizePrefs(raw.prefs),
  };
}
