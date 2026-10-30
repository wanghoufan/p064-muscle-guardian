/**
 * 方案 B 色板（用户选定的「卡片数据」方向）：米白背景、健康绿主色、圆角白卡。
 * 所有组件一律经 useTheme().colors 取色，不静态引用。
 */
export const lightColors = {
  background: '#F7F4EC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F4F1',
  primary: '#2E7D4F',
  primarySoft: '#E4F1E8',
  textPrimary: '#1F2A24',
  textSecondary: '#7C8A81',
  border: '#E3E0D5',
  danger: '#C6453D',
  track: '#EDEAE0',
  overlay: 'rgba(0,0,0,0.45)',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  background: '#0F1512',
  surface: '#1A231E',
  surfaceAlt: '#222C26',
  primary: '#57B17E',
  primarySoft: '#1E3327',
  textPrimary: '#EAF2EC',
  textSecondary: '#9DB0A4',
  border: '#2B3831',
  danger: '#E06B62',
  track: '#243029',
  overlay: 'rgba(0,0,0,0.65)',
};
