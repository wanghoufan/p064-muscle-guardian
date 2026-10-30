/** 计时与语音提示的纯函数（可单测，不依赖 React）。 */

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 12 → "12秒"；60 → "1分钟"；80 → "1分20秒" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分钟`;
  return `${m}分${s}秒`;
}

export function roundMinutes(seconds: number): number {
  return Math.round(Math.max(0, seconds) / 60);
}

/** 卡片展示用：不足 1 分钟说「不到 1 分钟」，避免长辈看到 0 分钟以为没记上。 */
export function durationLabel(seconds: number): string {
  if (seconds <= 0) return '0 分钟';
  if (seconds < 60) return '不到 1 分钟';
  return `${Math.round(seconds / 60)} 分钟`;
}

export type VoiceMark = { mark: number; text: string } | null;

/**
 * 整分钟播报判定：
 * - 倒计时：剩余跨过整分钟 → 「还剩 N 分钟」（3 分钟档在 2:00 / 1:00 各播一次）
 * - 正计时：已练跨过整分钟 → 「已练 N 分钟」
 * 返回 null 表示本 tick 不播报；lastMark 由调用方保存。
 */
export function nextVoiceMark(
  mode: 'countdown' | 'free',
  targetMs: number,
  elapsedMs: number,
  lastMark: number,
  text: (min: number) => string,
): VoiceMark {
  if (mode === 'countdown') {
    const mark = Math.ceil(Math.max(0, targetMs - elapsedMs) / 60000);
    if (mark > 0 && mark < lastMark) return { mark, text: text(mark) };
    return null;
  }
  const mark = Math.floor(Math.max(0, elapsedMs) / 60000);
  if (mark > 0 && mark !== lastMark) return { mark, text: text(mark) };
  return null;
}

export function initialVoiceMark(mode: 'countdown' | 'free', targetMs: number): number {
  return mode === 'countdown' ? Math.ceil(targetMs / 60000) : 0;
}

export function startTimestamp(seconds: number, endedAt: Date): string {
  return new Date(endedAt.getTime() - seconds * 1000).toISOString();
}
