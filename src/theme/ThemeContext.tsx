import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, Palette } from './colors';
import { makeShadows, Shadows } from './shadows';
import { makeTypography, Typography } from './typography';
import { ThemeMode } from '../types';

/**
 * 主题三态：system（默认）/ light / dark。
 * 独立持久化键 `themeMode`，坏值/读取失败一律回退 system；切换即时生效。
 */
const THEME_STORAGE_KEY = 'themeMode';

export interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: Palette;
  shadows: Shadows;
  typography: Typography;
  isDark: boolean;
}

const base = {
  mode: 'system' as ThemeMode,
  setMode: () => undefined,
  colors: lightColors,
  shadows: makeShadows(lightColors),
  typography: makeTypography(lightColors),
  isDark: false,
};

const ThemeContext = createContext<ThemeContextValue>(base);

export function ThemeProvider({ children, initialMode }: { children: React.ReactNode; initialMode?: ThemeMode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? 'system');
  const systemScheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && (raw === 'system' || raw === 'light' || raw === 'dark')) {
          setModeState(raw);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 必须是稳定引用：调用方（App 的 hydrate effect）把它放进依赖数组，
  // 若每次渲染都换新函数，会让 hydrate 反复重跑并把已改的偏好回滚成持久化的旧值。
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      colors,
      shadows: makeShadows(colors),
      typography: makeTypography(colors),
      isDark,
    }),
    [mode, colors, isDark, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
