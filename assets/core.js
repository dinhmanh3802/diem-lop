/* =====================================================================
   SỔ ĐIỂM — lõi dùng chung cho trang quản lý và trang tra điểm
   ===================================================================== */
'use strict';

var App = window.App = window.App || {};
App.version = '6.0.0';
App.ten = 'Vật Lý Cô Lâm Cường';

/* ---------------- DOM, định dạng ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
function fmtDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
function fmtScore(n) { if (n === null || n === undefined || n === '' || isNaN(n)) return '—'; var v = Math.round(Number(n) * 100) / 100; return String(v).replace('.', ','); }
function pad6(s) { s = String(s || '').replace(/\D/g, ''); while (s.length && s.length < 6) s = '0' + s; return s; }
function initials(name) {
  var p = String(name || '?').trim().split(/\s+/).map(function (w) { return w.replace(/[^A-Za-zÀ-ỹĐđ0-9]/g, ''); }).filter(Boolean);
  return (p[p.length - 1] || '?').charAt(0).toUpperCase();
}
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- biểu tượng (vẽ tay, nét 1.8) ---------------- */
var ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  sheet: 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 12.5h7M8.5 16h5',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  key: 'M15 7.5a4.5 4.5 0 1 1-4.3 5.8L3 21v-3l1.5-1.5H6V15h1.5l1.4-1.4A4.5 4.5 0 0 1 15 7.5zM16.5 8.5h.01',
  inbox: 'M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1.5 2.5h5L16 13h5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6 6 18',
  chevR: 'M9 6l6 6-6 6', chevL: 'M15 6l-6 6 6 6', chevD: 'M6 9l6 6 6-6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  download: 'M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17M15.5 9.5h.01',
  pen: 'M14.5 5.5l4 4M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z',
  trash: 'M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5a1 1 0 0 0 1 .9h9a1 1 0 0 0 1-.9l1-12.5M9 7V4.5h6V7',
  archive: 'M3 5h18v4H3zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3.1 3.9M6.5 6.6C3.8 8.4 2.5 12 2.5 12S6 19 12 19a9.5 9.5 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  alert: 'M12 9v4M12 16.5h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5h.01',
  okc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.8 2.8L16.5 9.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  send: 'M21 3 10 14M21 3l-6.5 18-4-7.5L3 9.5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  file: 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5 12 22.5 21 17.5',
  bubble: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3'
};
function icon(name, cls) {
  var d = ICONS[name] || ICONS.bubble;
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
}

/* ---------------- phiên đăng nhập (lưu trên máy) ---------------- */
var Session = {
  token: function () { try { return localStorage.getItem('sd_token') || ''; } catch (e) { return ''; } },
  user: function () { try { return JSON.parse(localStorage.getItem('sd_user') || 'null'); } catch (e) { return null; } },
  set: function (token, user) { try { localStorage.setItem('sd_token', token); localStorage.setItem('sd_user', JSON.stringify(user)); } catch (e) {} },
  setToken: function (token) { try { localStorage.setItem('sd_token', token); } catch (e) {} },
  clear: function () { try { localStorage.removeItem('sd_token'); localStorage.removeItem('sd_user'); } catch (e) {} }
};

/* ---------------- gọi máy chủ ---------------- */
var READ_ACTIONS = { ddTongQuan: 1, ddPhanTich: 1, ddXemBuoi: 1, ping: 1, bootstrap: 1, listGroups: 1, listStudents: 1, listBai: 1, getBai: 1, getBaiFull: 1, anhInfo: 1, getKetQua: 1,
  getNhatKy: 1, thongKeBai: 1, listUsers: 1, getCaiDat: 1, listGopY: 1, trangThaiTuDong: 1, publicConfig: 1, traDiem: 1, chiTietBai: 1, nhatKyLoi: 1, validateRoster: 1 };

function ApiError(code, message) { var e = new Error(message); e.code = code; return e; }

var Api = (function () {
  var inflight = 0, barTimer = null, cache = {};
  function bar(delta) {
    inflight = Math.max(0, inflight + delta);
    var el = document.getElementById('topbar');
    if (!el) return;
    var i = el.firstElementChild;
    if (inflight > 0) {
      if (!el.classList.contains('on') && !barTimer) {
        barTimer = setTimeout(function () { barTimer = null; if (inflight > 0) { el.classList.add('on'); i.style.width = '35%'; setTimeout(function () { if (inflight > 0) i.style.width = '72%'; }, 500); } }, 120);
      }
    } else {
      if (barTimer) { clearTimeout(barTimer); barTimer = null; }
      if (el.classList.contains('on')) { i.style.width = '100%'; setTimeout(function () { el.classList.remove('on'); i.style.width = '0'; }, 260); }
    }
  }
  function url() { return (window.APP_CONFIG && window.APP_CONFIG.API_URL) || ''; }

  async function call(action, params, opts) {
    params = params || {}; opts = opts || {};
    if (!/^https?:\/\//.test(url())) throw ApiError('CONFIG', 'Chưa cấu hình địa chỉ máy chủ. Mở file config.js và dán URL web app vào API_URL.');
    var body = Object.assign({ action: action }, params);
    var tok = Session.token();
    if (tok && !opts.noAuth) body.token = tok;
    var tries = opts.retry !== undefined ? opts.retry : (READ_ACTIONS[action] ? 2 : 0);
    for (var t = 0; ; t++) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, opts.timeout || 45000);
      if (!opts.silent) bar(+1);
      try {
        var res = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: ctrl ? ctrl.signal : undefined });
        var j;
        try { j = await res.json(); } catch (e) { throw ApiError('BAD', 'Máy chủ trả về dữ liệu không đọc được. Kiểm tra URL trong config.js và việc Deploy (Who has access: Anyone).'); }
        if (!j.ok) {
          var err = ApiError(j.code || 'ERR', j.error || 'Có lỗi xảy ra');
          if (err.code === 'AUTH' && !opts.noAuth) {
            // Yêu cầu gửi bằng phiên cũ (vd vừa đổi mật khẩu, máy đã có phiên mới): gửi lại bằng phiên mới
            var now = Session.token();
            if (tok && now && now !== tok && !opts._retried) { opts._retried = true; body.token = tok = now; t--; continue; }
            if (App.onAuthLost) App.onAuthLost(err);
          }
          throw err;
        }
        if (!READ_ACTIONS[action]) invalidate();
        return j.data;
      } catch (e) {
        var isNet = (e && e.name === 'AbortError') || (e instanceof TypeError);
        if (isNet && t < tries) { await sleep(700 * (t + 1)); continue; }
        if (e && e.name === 'AbortError') throw ApiError('TIMEOUT', 'Máy chủ phản hồi quá lâu. Kiểm tra mạng rồi thử lại.');
        if (e instanceof TypeError) throw ApiError('NETWORK', navigator.onLine === false ? 'Đang mất mạng. Kiểm tra wifi hoặc 4G rồi thử lại.' : 'Không kết nối được máy chủ. Thử lại sau giây lát.');
        throw e;
      } finally {
        clearTimeout(to);
        if (!opts.silent) bar(-1);
      }
    }
  }

  /**
   * Hiện ngay dữ liệu đã có trong bộ nhớ (nếu còn mới), đồng thời tải bản mới ở nền.
   * onData được gọi 1–2 lần: lần đầu với dữ liệu cũ (nếu có), lần sau với dữ liệu mới nếu khác.
   */
  function swr(action, params, onData, opts) {
    opts = opts || {};
    var key = action + ':' + JSON.stringify(params || {});
    var hit = cache[key];
    if (!hit) { try { var s = sessionStorage.getItem('sd_c_' + key); if (s) hit = cache[key] = JSON.parse(s); } catch (e) {} }
    var fresh = hit && (Date.now() - hit.t) < (opts.maxAge || 120000);
    if (hit) onData(hit.d, true);
    var p = call(action, params, { silent: !!hit }).then(function (d) {
      var s = JSON.stringify(d);
      if (!hit || hit.s !== s) onData(d, false);
      cache[key] = { t: Date.now(), d: d, s: s };
      try { sessionStorage.setItem('sd_c_' + key, JSON.stringify(cache[key])); } catch (e) {}
      return d;
    });
    if (hit && fresh) p.catch(function () {});
    return hit ? p.catch(function (e) { if (!fresh) throw e; }) : p;
  }
  function invalidate(prefix) {
    Object.keys(cache).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete cache[k]; });
    try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('sd_c_') === 0 && (!prefix || k.indexOf('sd_c_' + prefix) === 0)) sessionStorage.removeItem(k); }); } catch (e) {}
  }
  /** Tải trước (khi rê chuột / chạm vào liên kết) để lúc mở trang có dữ liệu ngay */
  function prefetch(action, params) {
    var key = action + ':' + JSON.stringify(params || {});
    if (cache[key] && Date.now() - cache[key].t < 60000) return;
    if (prefetch._busy[key]) return;
    prefetch._busy[key] = 1;
    call(action, params, { silent: true }).then(function (d) {
      var s = JSON.stringify(d); cache[key] = { t: Date.now(), d: d, s: s };
      try { sessionStorage.setItem('sd_c_' + key, JSON.stringify(cache[key])); } catch (e) {}
    }).catch(function () {}).then(function () { delete prefetch._busy[key]; });
  }
  prefetch._busy = {};
  return { call: call, swr: swr, invalidate: invalidate, prefetch: prefetch };
})();

/* ---------------- thông báo ---------------- */
function toast(msg, type, ms) {
  type = type || 'info';
  var box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  var dur = ms || (type === 'error' ? 6500 : 3200);
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = icon(type === 'success' ? 'okc' : type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'info') +
    '<div class="grow">' + esc(msg) + '</div><button class="x" aria-label="Đóng">×</button><i class="bar" style="animation-duration:' + dur + 'ms"></i>';
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstElementChild);
  var gone = false;
  var close = function () { if (gone) return; gone = true; el.classList.add('out'); setTimeout(function () { el.remove(); }, 260); };
  el.querySelector('.x').onclick = close;
  setTimeout(close, dur);
  return el;
}
function toastErr(e) { toast((e && e.message) || String(e), 'error'); }

/* ---------------- hiệu ứng gợn khi bấm ---------------- */
document.addEventListener('pointerdown', function (e) {
  var b = e.target.closest && e.target.closest('.btn, .ma-tab, .chip, .nav-item');
  if (!b || reduceMotion) return;
  var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
  var rip = document.createElement('span');
  rip.className = 'ripple';
  rip.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.style.overflow = 'hidden';
  b.appendChild(rip);
  setTimeout(function () { rip.remove(); }, 560);
}, { passive: true });

/* ---------------- nút đang xử lý ---------------- */
/**
 * busy(nút, hàm bất đồng bộ): khóa nút, hiện vòng quay, chống bấm hai lần, báo lỗi rõ ràng.
 * opts.ok: chữ thông báo khi xong; opts.done: nháy dấu tích xanh trên nút.
 */
async function busy(btn, fn, opts) {
  opts = opts || {};
  if (btn && btn.classList.contains('is-loading')) return;
  var t0 = Date.now(), sp = null;
  if (btn) {
    btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
    sp = document.createElement('span'); sp.className = 'spin'; btn.appendChild(sp);
  }
  try {
    var r = await fn();
    var wait = 260 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    if (opts.ok) toast(opts.ok, 'success');
    if (btn && opts.done && btn.isConnected) {
      btn.classList.add('is-done');
      var keep = btn.innerHTML;
      setTimeout(function () { if (btn.isConnected) btn.classList.remove('is-done'); }, 1100);
    }
    return r;
  } catch (e) {
    if (!opts.silent) toastErr(e);
    if (opts.rethrow) throw e;
  } finally {
    if (btn) { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); if (sp) sp.remove(); }
  }
}

/* ---------------- hộp thoại ---------------- */
var Modal = {
  _open: [],
  /** Đóng mọi hộp đang mở (khi chuyển trang, kể cả bấm nút Quay lại của điện thoại) */
  closeAll: function () { Modal._open.slice().forEach(function (f) { f(); }); $$('.menu-pop').forEach(function (m) { m.remove(); }); },
  open: function (o) {
    o = o || {};
    var root = document.createElement('div');
    root.className = 'modal-root';
    root.innerHTML = '<div class="modal-bg"></div><div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
      (o.title ? '<div class="modal-h"><h2>' + esc(o.title) + '</h2>' + (o.dismissible === false ? '' : '<button class="btn btn-ghost btn-icon btn-sm m-x" aria-label="Đóng">' + icon('x') + '</button>') + '</div>' : '') +
      '<div class="modal-b">' + (o.body || '') + '</div>' +
      (o.actions && o.actions.length ? '<div class="modal-f"></div>' : '') + '</div>';
    document.body.appendChild(root);
    var prevFocus = document.activeElement, closed = false;
    var closer = function () { ctl.close(); };
    Modal._open.push(closer);
    var ctl = {
      el: root, $: function (s) { return root.querySelector(s); }, $$: function (s) { return $$(s, root); },
      setBody: function (h) { root.querySelector('.modal-b').innerHTML = h; },
      close: function (val) {
        if (closed) return; closed = true;
        Modal._open = Modal._open.filter(function (f) { return f !== closer; });
        root.classList.add('closing');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(function () { root.remove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} }, 200);
        if (o.onClose) o.onClose(val);
      }
    };
    var foot = root.querySelector('.modal-f');
    (o.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.kind || '');
      b.innerHTML = (a.icon ? icon(a.icon) : '') + '<span>' + esc(a.label) + '</span>';
      if (a.id) b.id = a.id;
      b.onclick = function () {
        if (!a.onClick) return ctl.close(a.value);
        var r = a.onClick(ctl, b);
        if (r && r.then) busy(b, function () { return r; });     // lỗi trong nút của hộp thoại được báo rõ, không bị nuốt
      };
      foot.appendChild(b);
    });
    var x = root.querySelector('.m-x');
    if (x) x.onclick = function () { ctl.close(); };
    if (o.dismissible !== false) root.querySelector('.modal-bg').onclick = function () { ctl.close(); };
    function onKey(e) {
      if (e.key === 'Escape' && o.dismissible !== false) { e.preventDefault(); ctl.close(); }
      if (e.key === 'Tab') {
        var f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () {
      var first = root.querySelector('[autofocus], .modal-b input, .modal-b select, .modal-b textarea, .modal-f .btn-primary');
      if (first) try { first.focus(); } catch (e) {}
    }, 60);
    return ctl;
  },
  /** Hỏi xác nhận. Có typeToConfirm thì bắt gõ lại đúng chữ đó (dùng khi xóa) */
  confirm: function (o) {
    return new Promise(function (resolve) {
      var body = '<p>' + (o.html || esc(o.message || '')) + '</p>' +
        (o.typeToConfirm ? '<div class="field" style="margin-top:14px"><label>Gõ lại <b>' + esc(o.typeToConfirm) + '</b> để xác nhận</label><input class="input" id="m-type" autocomplete="off"></div>' : '');
      var m = Modal.open({
        title: o.title || 'Xác nhận', body: body, onClose: function (v) { resolve(v === true); },
        actions: [{ label: o.cancelText || 'Hủy', kind: 'btn-ghost', value: false },
          { label: o.confirmText || 'Đồng ý', kind: o.danger ? 'btn-danger solid' : 'btn-primary', id: 'm-ok', onClick: function (c) { c.close(true); } }]
      });
      if (o.typeToConfirm) {
        var ok = m.$('#m-ok'), inp = m.$('#m-type');
        ok.disabled = true;
        inp.oninput = function () { ok.disabled = inp.value.trim() !== String(o.typeToConfirm).trim(); };
        inp.onkeydown = function (e) { if (e.key === 'Enter' && !ok.disabled) ok.click(); };
      }
    });
  }
};

/* ---------------- tải thư viện ngoài khi cần (PDF, Excel) ---------------- */
var _scripts = {};
function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = function () { delete _scripts[src]; reject(ApiError('NETWORK', 'Không tải được thư viện cần thiết. Kiểm tra mạng rồi thử lại.')); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}
var LIB = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
};
async function needXLSX() { if (!window.XLSX) await loadScript(LIB.xlsx); return window.XLSX; }
async function needPDF() {
  if (!window.pdfjsLib) await loadScript(LIB.pdf);
  if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
  return window.pdfjsLib;
}

/* ---------------- chuyển cảnh, đếm số, khung xương ---------------- */
/* Thay nội dung NGAY LẬP TỨC (để gắn sự kiện ngay sau đó được), hiệu ứng vào trang chạy bằng CSS.
   Không dùng document.startViewTransition: nó cập nhật trang trễ một nhịp nên code gắn nút phía sau tìm không thấy phần tử. */
function swap(el, html) {
  if (!el) return;
  el.innerHTML = html;
  el.classList.remove('view-enter'); void el.offsetWidth; el.classList.add('view-enter');
}
function countUp(el, to, ms, dec) {
  to = Number(to) || 0;
  if (reduceMotion || !el) { if (el) el.textContent = fmtScore(to); return; }
  var t0 = performance.now(), d = ms || 900;
  var step = function (now) {
    var k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
    el.textContent = dec === 0 ? String(Math.round(to * e)) : fmtScore(Math.round(to * e * 100) / 100);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function skPage() {
  return '<div class="page"><div class="sk sk-title"></div><div class="grid grid-3"><div class="sk sk-block"></div><div class="sk sk-block"></div><div class="sk sk-block"></div></div>' +
    '<div class="panel" style="margin-top:18px">' + [80, 95, 70, 88, 60].map(function (w) { return '<div class="sk sk-line" style="width:' + w + '%"></div>'; }).join('') + '</div></div>';
}
function emptyState(ico, title, text, btnHtml) {
  return '<div class="empty">' + icon(ico, 'ico') + '<h3>' + esc(title) + '</h3><p>' + esc(text || '') + '</p>' + (btnHtml || '') + '</div>';
}

/* ---------------- mất mạng ---------------- */
function offlineBanner() {
  var show = function () {
    var b = document.getElementById('offline');
    if (navigator.onLine === false) { if (!b) { b = document.createElement('div'); b.id = 'offline'; b.textContent = 'Đang mất mạng: thao tác sẽ được thử lại khi có mạng'; document.body.appendChild(b); } }
    else if (b) b.remove();
  };
  window.addEventListener('online', function () { show(); toast('Đã có mạng trở lại', 'success'); });
  window.addEventListener('offline', show);
  show();
}

/* ---------------- menu thả xuống ---------------- */
function popMenu(anchor, items) {
  $$('.menu-pop').forEach(function (m) { m.remove(); });
  var wrap = anchor.closest('.menu') || anchor.parentElement;
  var pop = document.createElement('div');
  pop.className = 'menu-pop';
  pop.setAttribute('role', 'menu');
  items.forEach(function (it) {
    if (it === '-') { pop.appendChild(document.createElement('hr')); return; }
    var b = document.createElement('button');
    b.className = it.danger ? 'danger' : '';
    b.setAttribute('role', 'menuitem');
    b.innerHTML = icon(it.icon || 'bubble') + '<span>' + esc(it.label) + '</span>';
    b.onclick = function (e) { e.stopPropagation(); pop.remove(); it.onClick(); };
    pop.appendChild(b);
  });
  wrap.appendChild(pop);
  setTimeout(function () {
    var off = function (e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', off); } };
    document.addEventListener('click', off);
  }, 0);
}

App.Api = Api; App.Session = Session; App.Modal = Modal;

/* các liên kết href="javascript:void 0" chỉ để bấm: không điều hướng */
document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="javascript:"]'); if (a) e.preventDefault(); }, true);

/* ---------------- nhãn: giá trị (trình bày tách bạch) ----------------
   kv([['Hạng', '3/33'], ['Điểm TB lớp', '7,28']]) -> "Hạng: 3/33" với giá trị in đậm.
   Phần tử thứ 3 là lớp CSS thêm cho giá trị; thứ 4 = true nếu giá trị đã là HTML. */
function kv(items, cls) {
  return '<dl class="kv ' + (cls || '') + '">' + items.filter(function (x) { return x && x[1] !== null && x[1] !== undefined && x[1] !== ''; }).map(function (x) {
    return '<div><dt>' + esc(x[0]) + '</dt><dd' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + (x[3] ? x[1] : esc(x[1])) + '</dd></div>';
  }).join('') + '</dl>';
}

/* ---------------- bung bong bóng ăn mừng (điểm cao, gửi điểm danh, công bố) ---------------- */
function celebrate(x, y, n) {
  if (reduceMotion || !document.body) return;
  var cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:130';
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  var g = cv.getContext && cv.getContext('2d');
  if (!g || !g.arc) { cv.remove(); return; }
  g.scale(dpr, dpr);
  x = x === undefined ? innerWidth / 2 : x; y = y === undefined ? innerHeight / 3 : y;
  var colors = ['#2346C8', '#6D4AFF', '#16B5C9', '#16855B', '#F2B544', '#23262B'], ps = [];
  for (var i = 0; i < (n || 46); i++) {
    var a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
    ps.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: 3 + Math.random() * 7, c: colors[i % colors.length], ring: Math.random() < .35, life: 1 });
  }
  var t0 = performance.now();
  (function frame(now) {
    var k = (now - t0) / 1200;
    g.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(function (p) {
      p.vy += .22; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.life = Math.max(0, 1 - k);
      g.globalAlpha = p.life; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.ring) { g.lineWidth = 2; g.strokeStyle = p.c; g.stroke(); } else { g.fillStyle = p.c; g.fill(); }
    });
    if (k < 1) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}
function celebrateAt(el) { if (!el || !el.getBoundingClientRect) return celebrate(); var r = el.getBoundingClientRect(); celebrate(r.left + r.width / 2, r.top + r.height / 2); }

/* ---------------- đánh thức máy chủ sớm (Apps Script "ngủ" thì lượt gọi đầu chậm) ---------------- */
function warmUp() { try { Api.call('ping', {}, { silent: true, noAuth: true, retry: 0 }).catch(function () {}); } catch (e) {} }
