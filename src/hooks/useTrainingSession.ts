import { useCallback, useEffect, useRef, useState } from 'react';
import { initialVoiceMark, nextVoiceMark } from '../domain/timer';
import { STR } from '../i18n/strings';
import { speak, stop } from '../services/speech';
import { releaseWakeLock, requestWakeLock } from '../services/wakeLock';
import { TrainingMode } from '../types';

export type Phase = 'idle' | 'counting' | 'running' | 'paused';

export interface SessionResult {
  seconds: number;
  mode: TrainingMode;
  targetSeconds?: number;
}

interface Options {
  onComplete: (result: SessionResult) => void;
}

/**
 * 训练计时：墙钟计算（息屏/切后台回前台不漂移）＋ 3-2-1 口令 ＋ 整分钟播报。
 * 归零或手动结束时通过 onComplete 交给页面弹「算数/不算」，本 hook 不落库。
 */
export function useTrainingSession({ onComplete }: Options) {
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [mode, setMode] = useState<TrainingMode>('countdown');
  const [targetMs, setTargetMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** 3-2-1 口令进度：0=三 1=二 2=一 3=开始；-1 表示不显示 */
  const [countStep, setCountStep] = useState(-1);

  const phaseRef = useRef<Phase>('idle');
  const modeRef = useRef<TrainingMode>('countdown');
  const targetRef = useRef(0);
  const startAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseAtRef = useRef(0);
  const markRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearSequence = useCallback(() => {
    seqRef.current.forEach(clearTimeout);
    seqRef.current = [];
  }, []);

  const computeElapsed = useCallback(() => {
    return Date.now() - startAtRef.current - pausedTotalRef.current;
  }, []);

  const finish = useCallback(
    (natural: boolean) => {
      if (phaseRef.current === 'idle') return;
      clearTick();
      const currentElapsed = modeRef.current === 'countdown' && natural
        ? targetRef.current
        : computeElapsed();
      const seconds = Math.max(1, Math.round(currentElapsed / 1000));
      setPhase('idle');
      setElapsedMs(currentElapsed);
      releaseWakeLock();
      speak(STR.cueDone);
      completeRef.current({
        seconds,
        mode: modeRef.current,
        targetSeconds: modeRef.current === 'countdown' ? Math.round(targetRef.current / 1000) : undefined,
      });
    },
    [clearTick, computeElapsed, setPhase],
  );

  const startTicker = useCallback(() => {
    clearTick();
    tickRef.current = setInterval(() => {
      if (phaseRef.current !== 'running') return;
      const next = computeElapsed();
      setElapsedMs(next);
      if (modeRef.current === 'countdown' && next >= targetRef.current) {
        finish(true);
        return;
      }
      const cue = nextVoiceMark(
        modeRef.current,
        targetRef.current,
        next,
        markRef.current,
        modeRef.current === 'countdown' ? STR.cueRemaining : STR.cueElapsed,
      );
      if (cue) {
        markRef.current = cue.mark;
        speak(cue.text);
      }
    }, 250);
  }, [clearTick, computeElapsed, finish]);

  const beginRunning = useCallback(() => {
    startAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    setCountStep(-1);
    setPhase('running');
    startTicker();
    requestWakeLock();
  }, [setPhase, startTicker]);

  const startCountdown = useCallback(
    (minutes: number) => {
      if (phaseRef.current !== 'idle') return;
      const ms = minutes * 60000;
      modeRef.current = 'countdown';
      targetRef.current = ms;
      markRef.current = initialVoiceMark('countdown', ms);
      setMode('countdown');
      setTargetMs(ms);
      setElapsedMs(0);
      setPhase('counting');
      const words = [STR.countThree, STR.countTwo, STR.countOne, STR.countGo];
      words.forEach((word, index) => {
        seqRef.current.push(
          setTimeout(() => {
            if (phaseRef.current !== 'counting') return;
            setCountStep(index);
            speak(word);
          }, index * 900),
        );
      });
      seqRef.current.push(
        setTimeout(() => {
          if (phaseRef.current !== 'counting') return;
          beginRunning();
        }, words.length * 900 - 480),
      );
    },
    [beginRunning, setPhase],
  );

  const startFree = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    modeRef.current = 'free';
    targetRef.current = 0;
    markRef.current = 0;
    setMode('free');
    setTargetMs(0);
    setElapsedMs(0);
    setPhase('counting');
    const words = [STR.countThree, STR.countTwo, STR.countOne, STR.countGo];
    words.forEach((word, index) => {
      seqRef.current.push(
        setTimeout(() => {
          if (phaseRef.current !== 'counting') return;
          setCountStep(index);
          speak(word);
        }, index * 900),
      );
    });
    seqRef.current.push(
      setTimeout(() => {
        if (phaseRef.current !== 'counting') return;
        beginRunning();
      }, words.length * 900 - 480),
    );
  }, [beginRunning, setPhase]);

  const cancel = useCallback(() => {
    clearSequence();
    clearTick();
    stop();
    setCountStep(-1);
    setPhase('idle');
    setElapsedMs(0);
  }, [clearSequence, clearTick, setPhase]);

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    pauseAtRef.current = Date.now();
    clearTick();
    setPhase('paused');
  }, [clearTick, setPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    pausedTotalRef.current += Date.now() - pauseAtRef.current;
    setPhase('running');
    startTicker();
  }, [setPhase, startTicker]);

  const endNow = useCallback(() => {
    finish(false);
  }, [finish]);

  useEffect(() => {
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (phaseRef.current === 'running') {
        setElapsedMs(computeElapsed());
        requestWakeLock();
      }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      clearTick();
      clearSequence();
      releaseWakeLock();
    };
  }, [clearSequence, clearTick, computeElapsed]);

  const remainingMs = mode === 'countdown' ? Math.max(0, targetMs - elapsedMs) : elapsedMs;

  return {
    phase,
    mode,
    countStep,
    remainingMs,
    elapsedMs,
    startCountdown,
    startFree,
    cancel,
    pause,
    resume,
    endNow,
  };
}
