import * as Speech from 'expo-speech';
import { STR } from '../i18n/strings';

/**
 * 语音播报：Web 走浏览器 SpeechSynthesis，原生走系统 TTS。
 * 统一 zh-CN、语速 0.9；失败降级为静默（调用方保留提示音/大字兜底）。
 */
export interface Speaker {
  speak: (text: string) => void;
  stop: () => void;
}

let enabled = true;

export function setVoiceEnabled(value: boolean) {
  enabled = value;
  if (!value) stop();
}

export function isVoiceEnabled() {
  return enabled;
}

export function speak(text: string) {
  if (!enabled || !text) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'zh-CN', rate: 0.9 });
  } catch {
    // 语音不可用时静默，界面仍有大字与提示音
  }
}

export function stop() {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}

export const speaker: Speaker = { speak, stop };

/** 供测试与 UI 判断：Web 端是否存在中文语音。 */
export async function hasChineseVoice(): Promise<boolean> {
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
