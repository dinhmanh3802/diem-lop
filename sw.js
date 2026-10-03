/* Lưu sẵn giao diện để trang tra điểm mở nhanh và vẫn mở được khi mạng chập chờn.
   Đổi số phiên bản này mỗi khi cập nhật giao diện. Không bao giờ lưu dữ liệu điểm (gọi máy chủ luôn đi thẳng). */
const VERSION = 'sodiem-5.0.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './assets/app.css?v=5.0.0', './assets/core.js?v=5.0.0', './assets/public.js?v=5.0.0', './icons/icon-192.png', './icons/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;           // máy chủ điểm, thư viện ngoài: đi thẳng
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('config.js');
  if (isPage) {                                                                   // trang và config: lấy mới trước
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {                                   // tài nguyên: dùng bản lưu, cập nhật ngầm
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
