// 构建前语音闸：文案能映射到剪辑名（单元测试保证）之外，还要保证
// 每个剪辑文件真的在 public/voice 里——小米浏览器那类无 TTS 环境一旦缺文件就是全哑。
// 键名规则与 scripts/gen-voice.mjs 保持一致。
import { existsSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'public/voice');
const keys = ['prep-3', 'prep-2', 'prep-1', 'start', 'finish', 'done-more'];
for (let n = 1; n <= 10; n++) keys.push(`rest-${n}`);
for (let n = 1; n <= 30; n++) keys.push(`done-${n}`);

const missing = keys.filter((key) => !existsSync(path.join(dir, `${key}.mp3`)));
if (missing.length) {
  console.error(`VOICE-FAIL 缺少 ${missing.length} 个语音剪辑：${missing.slice(0, 8).join(', ')}…`);
  console.error('修复：node scripts/gen-voice.mjs（需 macOS say + ffmpeg）');
  process.exit(1);
}
console.log(`VOICE-OK ${keys.length} 个语音剪辑齐备`);
