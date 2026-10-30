// 完成 Expo 静态导出后的 PWA 加工：生成 manifest / service worker / .nojekyll，
// 并把 manifest、apple-touch-icon、theme-color 与 SW 注册注入 index.html。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

for (const name of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  fs.copyFileSync(path.join(root, 'web-assets', name), path.join(dist, name));
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const BG = '#F7F4EC';
// 小米自带浏览器（com.android.browser）对 manifest 用自有校验：start_url / icons 写相对路径
// 会被判不合格，菜单里的「添加到桌面」直接置灰。用 PUBLIC_ORIGIN 输出绝对地址规避。
const ORIGIN = (process.env.PUBLIC_ORIGIN || '').replace(/\/+$/, '');
const abs = (rel) => (ORIGIN ? `${ORIGIN}/${rel.replace(/^\.?\//, '')}` : `./${rel.replace(/^\.?\//, '')}`);
const START = ORIGIN ? `${ORIGIN}/` : './';
const manifest = {
  id: START,
  name: '肌肉守护者',
  short_name: '肌肉守护者',
  description: '每天蹲一会儿，腿更稳',
  lang: 'zh-CN',
  dir: 'ltr',
  start_url: START,
  scope: START,
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'portrait',
  background_color: BG,
  theme_color: BG,
  icons: [192, 512].map((size) => ({
    src: abs(`icon-${size}.png`),
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'any',
  })),
};
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const htmlPath = path.join(dist, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="zh-CN">');
html = html.replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover');
html = html.replace(
  '</head>',
  '  <link rel="manifest" href="./manifest.webmanifest" />\n' +
    '  <link rel="apple-touch-icon" href="./apple-touch-icon.png" />\n' +
    `  <meta name="theme-color" content="${BG}" />\n` +
    '  <meta name="apple-mobile-web-app-title" content="肌肉守护者" />\n' +
    '  <style>html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;max-width:100%;overflow-x:hidden}#root{max-width:100%;overflow-x:hidden}</style>\n' +
    '</head>',
);
html = html.replace(
  '</body>',
  "  <script>if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./service-worker.js').catch(function (error) { console.warn('service worker registration failed', error); }); });</script>\n</body>",
);
fs.writeFileSync(htmlPath, html);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}

// GitHub Pages 不提供点文件（.nojekyll 实测 404），预缓存清单必须剔除点文件，
// 否则 cache.addAll 失败、离线能力整体失效（062 实测踩坑）。
const all = files(dist)
  .filter((file) => {
    const rel = path.relative(dist, file);
    return !rel.endsWith('service-worker.js') && !rel.split(path.sep).some((part) => part.startsWith('.'));
  })
  .sort();
const hash = crypto.createHash('sha256');
for (const file of all) hash.update(path.relative(dist, file)).update(fs.readFileSync(file));
const cache = `muscle-keeper-${hash.digest('hex').slice(0, 16)}`;
const urls = all.map((file) => './' + path.relative(dist, file).split(path.sep).join('/'));
const sw =
  `const CACHE = ${JSON.stringify(cache)};\nconst FILES = ${JSON.stringify(urls)};\n` +
  String.raw`
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('muscle-keeper-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('./index.html', self.registration.scope).href)));
  } else {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
`;
fs.writeFileSync(path.join(dist, 'service-worker.js'), sw);

console.log(`PWA 加工完成：${all.length} 个预缓存文件，cache=${cache}`);
