import fs from 'node:fs';
import path from 'node:path';
import { STR } from '../../i18n/strings';
import { clipKey } from '../speech';

/**
 * 语音回归闸：文案与音频文件是两处，容易脱节。
 * 1) 每个需要播报的文案都必须能映射到剪辑名；
 * 2) 映射出的文件必须真实存在（否则小米浏览器那类无 TTS 环境直接哑）。
 */
const voiceDir = path.resolve(__dirname, '../../../public/voice');

const cueTexts = [STR.countThree, STR.countTwo, STR.countOne, STR.cueReady, STR.cueDone];
const remaining = Array.from({ length: 10 }, (_, i) => STR.cueRemaining(i + 1));
const elapsed = Array.from({ length: 30 }, (_, i) => STR.cueElapsed(i + 1));

describe('clipKey 文案映射', () => {
  it.each([...cueTexts, ...remaining, ...elapsed])('%s 有对应音频', (text) => {
    expect(clipKey(text)).toBeTruthy();
  });

  it('超出预生成范围的分钟数走兜底或明确返回 null', () => {
    expect(clipKey(STR.cueElapsed(31))).toBe('done-more');
    expect(clipKey(STR.cueRemaining(11))).toBeNull();
    expect(clipKey('随便一句话')).toBeNull();
  });
});

describe('音频文件齐备', () => {
  it('所有映射出的 mp3 都在 public/voice 里', () => {
    const keys = new Set<string>();
    for (const text of [...cueTexts, ...remaining, ...elapsed]) {
      const key = clipKey(text);
      if (key) keys.add(key);
    }
    keys.add('done-more');
    const missing = [...keys].filter((key) => !fs.existsSync(path.join(voiceDir, `${key}.mp3`)));
    expect(missing).toEqual([]);
  });
});
