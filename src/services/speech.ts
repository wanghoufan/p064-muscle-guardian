import * as Speech from 'expo-speech';
import { STR } from '../i18n/strings';

/**
 * 语音播报：优先播放**预置中文语音文件**（public/voice/*.mp3，随包离线可用），
 * 播放不了再退回系统 TTS。
 *
 * 为什么不用 Web Speech API：小米浏览器（MIUI Browser 20.x）没有
 * speechSynthesis / SpeechSynthesisUtterance，靠它等于没声音；
 * 预置音频在任何浏览器都能播，且断网也在 Service Worker 缓存里。
 */
export interface Speaker {
  speak: (text: string) => void;
  stop: () => void;
}

const BASE = './voice/';
const hasAudio = typeof window !== 'undefined' && typeof Audio !== 'undefined';

let enabled = true;
let current: HTMLAudioElement | null = null;
const pool = new Map<string, HTMLAudioElement>();

/** 文案 → 音频文件名（对不上返回 null，走 TTS 兜底）。 */
export function clipKey(text: string): string | null {
  if (text === STR.cueReady || text === STR.countGo) return 'start';
  if (text === STR.cueDone) return 'finish';
  if (text === STR.countThree) return 'prep-3';
  if (text === STR.countTwo) return 'prep-2';
  if (text === STR.countOne) return 'prep-1';
  const rest = /^还剩(\d+)分钟$/.exec(text);
  if (rest) {
    const n = Number(rest[1]);
    return n >= 1 && n <= 10 ? `rest-${n}` : null;
  }
  const done = /^已练(\d+)分钟$/.exec(text);
  if (done) {
    const n = Number(done[1]);
    if (n >= 1 && n <= 30) return `done-${n}`;
    return n > 30 ? 'done-more' : null;
  }
  return null;
}

function getAudio(key: string): HTMLAudioElement {
  let el = pool.get(key);
  if (!el) {
    el = new Audio(`${BASE}${key}.mp3`);
    el.preload = 'auto';
    pool.set(key, el);
  }
  return el;
}

/** 预热即将用到的剪辑，避免第一声延迟（可安全重复调用）。 */
export function preloadVoice(keys: string[] = []) {
  if (!hasAudio) return;
  for (const key of keys) {
    try {
      getAudio(key).load();
    } catch {
      // 预热失败不影响正式播放
    }
  }
}

function playClip(key: string): boolean {
  if (!hasAudio) return false;
  try {
    stop();
    const el = getAudio(key);
    try {
      el.currentTime = 0;
    } catch {
      // 元数据未就绪时忽略
    }
    current = el;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => undefined); // 被自动播放策略拦截时静默，界面仍有大字
    }
    return true;
  } catch {
    return false;
  }
}

export function setVoiceEnabled(value: boolean) {
  enabled = value;
  if (!value) stop();
}

export function isVoiceEnabled() {
  return enabled;
}

export function speak(text: string) {
  if (!enabled || !text) return;
  const key = clipKey(text);
  if (key && playClip(key)) return;
  // 兜底：系统 TTS（浏览器支持时）
  try {
    Speech.stop();
    Speech.speak(text, { language: 'zh-CN', rate: 0.9 });
  } catch {
    // 完全没有语音能力时静默，界面仍有大字
  }
}

export function stop() {
  if (current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {
      // ignore
    }
    current = null;
  }
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}

export const speaker: Speaker = { speak, stop };

/**
 * 语音是否可用：有预置音频能力即视为可用（不再依赖系统中文语音包）。
 * 只有拿不到音频能力时才去问系统 TTS。
 */
export async function isVoiceAvailable(): Promise<boolean> {
  if (hasAudio) return true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((v) => (v.language ?? '').toLowerCase().startsWith('zh'));
  } catch {
    return false;
  }
}

export const CUES = {
  ready: STR.cueReady,
  done: STR.cueDone,
};
