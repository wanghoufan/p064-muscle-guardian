/**
 * 训练中保持屏幕常亮（Web Wake Lock；不支持/被拒时静默降级）。
 * 每次切回前台需重新申请。
 */
type Sentinel = { release: () => Promise<void> } | null;

let sentinel: Sentinel = null;

export async function requestWakeLock(): Promise<void> {
  try {
    const anyNav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<Sentinel> };
    };
    if (!anyNav.wakeLock) return;
    sentinel = await anyNav.wakeLock.request('screen');
  } catch {
    sentinel = null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    // ignore
  }
  sentinel = null;
}
