import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { STR } from './src/i18n/strings';
import { PersistedState, TabKey, TrainingRecord, TestRecord, Preferences } from './src/types';
import { loadState, saveState, resetState } from './src/storage/storage';
import { setVoiceEnabled } from './src/services/speech';
import { hasChineseVoice } from './src/services/speech';
import { TrainScreen } from './src/features/train/TrainScreen';
import { TestScreen } from './src/features/test/TestScreen';
import { StatsScreen } from './src/features/stats/StatsScreen';
import { SettingsSheet } from './src/features/settings/SettingsSheet';
import { BottomTabs } from './src/components/BottomTabs';
import { spacing } from './src/theme/metrics';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const { colors, typography, setMode } = useTheme();
  const [state, setState] = useState<PersistedState | null>(null);
  const [tab, setTab] = useState<TabKey>('train');
  const [immersive, setImmersive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const hydrateRef = useRef(false);
  const loadStartedRef = useRef(false);

  // 只允许水合一次：重复水合会用持久化旧值覆盖用户刚刚改动的偏好（主题点不动的根因）。
  useEffect(() => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    let cancelled = false;
    loadState().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      hydrateRef.current = true;
      setMode(loaded.prefs.themeMode);
      setVoiceEnabled(loaded.prefs.voiceEnabled);
      if (typeof document !== 'undefined') document.documentElement.lang = 'zh-CN';
      void hasChineseVoice().then((ok) => {
        if (!cancelled) setVoiceAvailable(ok);
      });
      void SplashScreen.hideAsync().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [setMode]);

  useEffect(() => {
    if (!state || !hydrateRef.current) return;
    const timer = setTimeout(() => {
      void saveState(state);
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const updatePrefs = (patch: Partial<Preferences>) => {
    setState((prev) => (prev ? { ...prev, prefs: { ...prev.prefs, ...patch } } : prev));
    if (patch.themeMode) setMode(patch.themeMode);
    if (patch.voiceEnabled !== undefined) setVoiceEnabled(patch.voiceEnabled);
  };

  const addTraining = (r: { seconds: number; mode: 'countdown' | 'free'; targetSeconds?: number }) => {
    const now = new Date();
    const record: TrainingRecord = {
      id: `t-${now.getTime()}`,
      mode: r.mode,
      targetSeconds: r.targetSeconds,
      seconds: r.seconds,
      startedAt: new Date(now.getTime() - r.seconds * 1000).toISOString(),
      endedAt: now.toISOString(),
    };
    setState((prev) => {
      if (!prev) return prev;
      const lastDurationMinutes =
        r.mode === 'countdown' && r.targetSeconds ? Math.round(r.targetSeconds / 60) : prev.prefs.lastDurationMinutes;
      return { ...prev, trainings: [...prev.trainings, record], prefs: { ...prev.prefs, lastDurationMinutes } };
    });
  };

  const addTest = (seconds: number) => {
    const now = new Date();
    const record: TestRecord = { id: `s-${now.getTime()}`, seconds, testedAt: now.toISOString() };
    setState((prev) => (prev ? { ...prev, tests: [...prev.tests, record] } : prev));
  };

  const clearAll = () => {
    void resetState().then((fresh) => {
      setState(fresh);
      setMode('system');
      setVoiceEnabled(true);
    });
  };

  const content = useMemo(() => {
    if (!state) return null;
    if (tab === 'train') {
      return (
        <TrainScreen
          trainings={state.trainings}
          prefs={state.prefs}
          onTrainingDone={addTraining}
          onPrefsChange={updatePrefs}
          onImmersiveChange={setImmersive}
        />
      );
    }
    if (tab === 'test') {
      return <TestScreen tests={state.tests} onTestDone={addTest} />;
    }
    return <StatsScreen trainings={state.trainings} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tab]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View>
          <Text style={[typography.brand, { color: colors.textPrimary }]}>{STR.appName}</Text>
          <Text style={[typography.brandSub, { color: colors.textSecondary }]}>{STR.tagline}</Text>
        </View>
        {!immersive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={STR.settings}
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [
              styles.settingsBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>{STR.settings}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>{content}</View>

      {!immersive ? <BottomTabs active={tab} onChange={setTab} /> : null}

      {state ? (
        <SettingsSheet
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          prefs={state.prefs}
          onPatch={updatePrefs}
          onClear={clearAll}
          voiceAvailable={voiceAvailable}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 12 : 8,
    paddingBottom: 4,
  },
  settingsBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minHeight: 0, paddingHorizontal: spacing.lg, paddingTop: 2 },
});
