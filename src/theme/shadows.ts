import { Platform } from 'react-native';
import { Palette } from './colors';

export function makeShadows(_colors: Palette) {
  return {
    card: Platform.select({
      ios: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
      default: {},
    }) as object,
  };
}

export type Shadows = ReturnType<typeof makeShadows>;
