#!/usr/bin/env node
/**
 * Cloudflare Pages 直传部署（根路径域名，小米浏览器才允许「添加到桌面」）
 *
 * 用法：npm run deploy:cf
 * 前置：CLOUDFLARE_API_TOKEN 环境变量，或 ../.local/cf-token 文件（一行 CLOUDFLARE_API_TOKEN=xxx）
 * 产物域名：https://p064-muscle-guardian.pages.dev/
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'p064-muscle-guardian';
const ORIGIN = `https://${PROJECT}.pages.dev`;

function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim();
  for (const file of [resolve(root, '.local/cf-token'), resolve(root, '../059-ing-短视频拍摄助手/.local/cf-token')]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const m = raw.trim().match(/^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/);
      const v = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
      if (/^[A-Za-z0-9_-]{20,}$/.test(v)) return v;
    }
  }
  return '';
}

const token = readToken();
if (!token) {
  console.error('缺少 CLOUDFLARE_API_TOKEN（或 .local/cf-token）');
  process.exit(1);
}
if (!existsSync(resolve(root, 'dist/index.html'))) {
  console.error('dist 还没有产物，先 npm run build');
  process.exit(1);
}

const run = (args) =>
  spawnSync('npx', ['--yes', 'wrangler@4', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
  });

run(['pages', 'project', 'create', PROJECT, '--production-branch', 'main']);
const r = run(['pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true']);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`\n线上（根路径）：${ORIGIN}/`);
