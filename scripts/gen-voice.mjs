// 生成预置中文语音（macOS only：用 say 合成，ffmpeg 转 mp3）
// 用法：node scripts/gen-voice.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const VOICE = process.env.VOICE || 'Tingting';
const RATE = process.env.RATE || '165'; // 长辈听清，略慢于默认
const outDir = path.resolve('public/voice');
const tmpDir = path.resolve('.voice-tmp');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const items = [
  ['prep-3', '三'], ['prep-2', '二'], ['prep-1', '一'], ['start', '开始'],
  ['finish', '恭喜你，完成训练'],
  ['done-more', '已练三十分钟以上'],
];
for (let n = 1; n <= 10; n++) items.push([`rest-${n}`, `还剩${n}分钟`]);
for (let n = 1; n <= 30; n++) items.push([`done-${n}`, `已练${n}分钟`]);

for (const [key, text] of items) {
  const aiff = path.join(tmpDir, `${key}.aiff`);
  const mp3 = path.join(outDir, `${key}.mp3`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, text]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3]);
}
rmSync(tmpDir, { recursive: true, force: true });
console.log(`voice clips: ${items.length}`);
