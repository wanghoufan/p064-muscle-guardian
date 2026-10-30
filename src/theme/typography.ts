import { Palette } from './colors';

/** 排版预设。颜色跟随主题，由 useTheme() 派生。 */
export function makeTypography(colors: Palette) {
  return {
    brand: { fontSize: 21, fontWeight: '800' as const, color: colors.textPrimary },
    brandSub: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary },
    section: { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary },
    cardTitle: { fontSize: 19, fontWeight: '700' as const, color: colors.textPrimary },
    body: { fontSize: 19, fontWeight: '400' as const, color: colors.textPrimary },
    small: { fontSize: 15, fontWeight: '400' as const, color: colors.textSecondary },
    meta: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary },
    statValue: { fontSize: 34, fontWeight: '800' as const, color: colors.textPrimary },
    timer: { fontSize: 84, fontWeight: '800' as const, color: colors.textPrimary },
    timerSmall: { fontSize: 52, fontWeight: '800' as const, color: colors.textPrimary },
  };
}

export type Typography = ReturnType<typeof makeTypography>;
