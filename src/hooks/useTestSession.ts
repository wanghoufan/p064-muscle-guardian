import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 测试计时（正计时）：开始/结束两态；结束时把秒数交给页面弹「算满/不算」。
 */
export function useTestSession(onStop: (seconds: number) => void) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef(onStop);
  useEffect(() => {
    stopRef.current = onStop;
  }, [onStop]);

  const clear = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const start = useCallback(() => {
    clear();
    startRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 250);
  }, []);

  const stopTiming = useCallback(() => {
    clear();
    setRunning(false);
    const seconds = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    stopRef.current(seconds);
  }, []);

  useEffect(() => clear, []);

  return { running, elapsedMs, start, stop: stopTiming };
}
