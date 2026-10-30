import { STR } from '../../i18n/strings';
import { clipKey } from '../speech';

/**
 * 语音回归闸（纯逻辑层）：文案与音频文件是两处，容易脱节。
 * 每个需要播报的文案都必须能映射到剪辑名；文件是否真实存在由
 * `scripts/check-voice.mjs` 在构建前校验（那份脚本不依赖 TS 运行时）。
 */
const cueTexts = [STR.countThree, STR.countTwo, STR.countOne, STR.cueReady, STR.cueDone];
const remaining = Array.from({ length: 10 }, (_, i) => STR.cueRemaining(i + 1));
const elapsed = Array.from({ length: 30 }, (_, i) => STR.cueElapsed(i + 1));

describe('clipKey 文案映射', () => {
  it.each([...cueTexts, ...remaining, ...elapsed])('%s 有对应音频', (text) => {
    expect(clipKey(text)).toBeTruthy();
  });

  it('三二一与开始各有独立剪辑', () => {
    expect(clipKey(STR.countThree)).toBe('prep-3');
    expect(clipKey(STR.countTwo)).toBe('prep-2');
    expect(clipKey(STR.countOne)).toBe('prep-1');
    expect(clipKey(STR.cueReady)).toBe('start');
    expect(clipKey(STR.cueDone)).toBe('finish');
  });

  it('整分钟播报按分钟取剪辑', () => {
    expect(clipKey(STR.cueRemaining(3))).toBe('rest-3');
    expect(clipKey(STR.cueElapsed(12))).toBe('done-12');
  });

  it('超出预生成范围时走兜底或明确返回 null', () => {
    expect(clipKey(STR.cueElapsed(31))).toBe('done-more');
    expect(clipKey(STR.cueRemaining(11))).toBeNull();
    expect(clipKey('随便一句话')).toBeNull();
  });
});
