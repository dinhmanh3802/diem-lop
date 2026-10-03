/* =====================================================================
   SỔ ĐIỂM — trang quản lý: khung, điều hướng, đăng nhập, tổng quan,
   lớp & học sinh, tài khoản, góp ý, cài đặt
   ===================================================================== */
'use strict';

App.state = { user: null, groups: [], bai: [], caiDat: {}, gopYMoi: 0 };
var V = function () { return document.getElementById('view'); };
function isAdmin() { return App.state.user && App.state.user.role === 'admin'; }

/* ---------------- điều hướng (#/đường-dẫn), nút Back của trình duyệt dùng được ---------------- */
var Router = {
  routes: [], cur: '', guard: null,
  on: function (pattern, fn, opts) {
    var keys = [];
    var re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ re: re, keys: keys, fn: fn, nav: (opts && opts.nav) || pattern.split('/')[1] || '' });
  },
  go: function (path) { if (('#' + path) === location.hash) Router.resolve(); else location.hash = '#' + path; },
  start: function () { window.addEventListener('hashchange', function () { Router.resolve(); }); Router.resolve(); },
  resolve: async function () {
    var path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
    if (Router.guard && path !== Router.cur) {
      var ok = await Router.guard(path);
      if (!ok) { history.replaceState(null, '', '#' + Router.cur); return; }
      Router.guard = null;
    }
    Router.cur = path;
    Modal.closeAll();
    if (!document.getElementById('view')) return;           // đang ở màn đăng nhập: không vẽ trang
    for (var i = 0; i < this.routes.length; i++) {
      var r = this.routes[i], m = r.re.exec(path);
      if (!m) continue;
      var params = {};
      r.keys.forEach(function (k, j) { params[k] = m[j + 1]; });
      setNav(r.nav);
      window.scrollTo(0, 0);
      try { await r.fn(params); } catch (e) { toastErr(e); }
      return;
    }
    Router.go('/');
  }
};
function setNav(key) {
  $$('.nav-item, .tabbar a').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === key); });
}

/* ---------------- khởi động ---------------- */
App.onAuthLost = function () {
  if (App._authLost) return;
  App._authLost = true;
  Session.clear();
  toast('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại', 'warn');
  setTimeout(function () { App._authLost = false; showLogin(); }, 300);
};

async function boot() {
  offlineBanner();
  if (!(window.APP_CONFIG && /^https?:\/\//.test(window.APP_CONFIG.API_URL || ''))) {
    document.getElementById('root').innerHTML = '<div class="login"><div class="login-card"><div class="brand"><i class="mark"></i>Sổ điểm</div><h1>Chưa kết nối máy chủ</h1>' +
      '<p class="muted" style="margin:8px 0 0">Mở file <b>config.js</b> trên GitHub và dán địa chỉ web app (Apps Script) vào <b>API_URL</b>. Xem hướng dẫn cài đặt.</p></div></div>';
    return;
  }
  if (!Session.token()) return showLogin();
  await loadShell();
}

async function loadShell() {
  var root = document.getElementById('root');
  if (!$('.app')) root.innerHTML = '<div class="main"><div id="view">' + skPage() + '</div></div>';
  try {
    var b = await Api.call('bootstrap');
    Object.assign(App.state, { user: b.user, groups: b.groups || [], bai: b.bai || [], caiDat: b.caiDat || {}, gopYMoi: b.gopYMoi || 0 });
    var u = Session.user() || {};
    Session.set(Session.token(), Object.assign(u, b.user));
    renderShell();
    if (!Router.routes.length) registerRoutes();
    Router.start ? (Router._started ? Router.resolve() : (Router._started = true, Router.start())) : null;
    if ((Session.user() || {}).mustChange) forceChangePassword();
  } catch (e) {
    if (e.code === 'AUTH') return;
    root.innerHTML = '<div class="login"><div class="login-card">' + emptyState('alert', 'Không tải được dữ liệu', e.message, '<button class="btn btn-primary" id="retry">' + icon('refresh') + '<span>Thử lại</span></button>') + '</div></div>';
    $('#retry').onclick = function () { loadShell(); };
  }
}

function navItems() {
  var a = [
    { key: '', href: '#/', ico: 'home', label: 'Tổng quan' },
    { key: 'bai', href: '#/bai', ico: 'sheet', label: 'Bài kiểm tra' },
    { key: 'lop', href: '#/lop', ico: 'users', label: 'Lớp và học sinh' }
  ];
  if (isAdmin()) a.push({ key: 'tai-khoan', href: '#/tai-khoan', ico: 'key', label: 'Tài khoản' },
    { key: 'gop-y', href: '#/gop-y', ico: 'inbox', label: 'Góp ý', count: App.state.gopYMoi },
    { key: 'cai-dat', href: '#/cai-dat', ico: 'gear', label: 'Cài đặt' });
  return a;
}

function renderShell() {
  var u = App.state.user;
  var items = navItems();
  var nav = items.map(function (n) {
    return '<a class="nav-item" data-nav="' + n.key + '" href="' + n.href + '">' + icon(n.ico) + '<span>' + esc(n.label) + '</span>' + (n.count ? '<b class="count">' + n.count + '</b>' : '') + '</a>';
  }).join('');
  var tabs = items.slice(0, 3).map(function (n) {
    return '<a data-nav="' + n.key + '" href="' + n.href + '">' + icon(n.ico) + '<span>' + esc(n.label.split(' ')[0] === 'Lớp' ? 'Lớp' : n.label.replace('Bài kiểm tra', 'Bài')) + '</span></a>';
  }).join('') + '<a href="javascript:void 0" id="tabMore">' + icon('more') + '<span>Thêm</span>' + (App.state.gopYMoi ? '<i class="dot"></i>' : '') + '</a>';
  document.getElementById('root').innerHTML =
    '<div class="app">' +
    '<aside class="side"><div class="brand"><i class="mark"></i>Sổ điểm</div>' + nav + '<div class="spacer"></div>' +
    '<div class="who"><div class="avatar">' + esc(initials(u.fullName || u.username)) + '</div><div class="grow"><div style="font-weight:600">' + esc(u.fullName || u.username) + '</div>' +
    '<div class="small muted">' + (u.role === 'admin' ? 'Quản trị' : 'Giáo viên') + '</div></div><div class="menu"><button class="btn btn-ghost btn-icon btn-sm" id="userMenu" aria-label="Tài khoản">' + icon('more') + '</button></div></div></aside>' +
    '<header class="topbar-m"><div class="brand"><i class="mark"></i>Sổ điểm</div><div class="menu"><button class="avatar" id="userMenuM" style="border:0;cursor:pointer" aria-label="Tài khoản">' + esc(initials(u.fullName || u.username)) + '</button></div></header>' +
    '<main class="main"><div id="view"></div></main>' +
    '<nav class="tabbar">' + tabs + '</nav></div>';
  var menu = function (anchor) {
    popMenu(anchor, [
      { label: 'Đổi mật khẩu', icon: 'lock', onClick: function () { changePasswordModal(false); } },
      { label: isAdmin() ? 'Xem nhật ký lỗi' : 'Gửi góp ý cho quản trị', icon: isAdmin() ? 'alert' : 'send', onClick: function () { isAdmin() ? errorLogModal() : feedbackModal(); } },
      { label: 'Mở trang tra điểm', icon: 'link', onClick: function () { window.open('index.html', '_blank'); } },
      '-',
      { label: 'Đăng xuất', icon: 'logout', danger: true, onClick: logout }
    ]);
  };
  $('#userMenu').onclick = function (e) { e.stopPropagation(); menu(this); };
  $('#userMenuM').onclick = function (e) { e.stopPropagation(); menu(this); };
  $('#tabMore').onclick = function () {
    var more = navItems().slice(3);
    var m = Modal.open({
      title: 'Thêm', body: '<div class="list">' + more.map(function (n) {
        return '<a class="item" href="' + n.href + '">' + icon(n.ico, 'chev') + '<div class="grow t">' + esc(n.label) + '</div>' + (n.count ? '<span class="badge red plain">' + n.count + '</span>' : '') + '</a>';
      }).join('') +
        '<a class="item" href="javascript:void 0" id="mChangePw">' + icon('lock', 'chev') + '<div class="grow t">Đổi mật khẩu</div></a>' +
        (isAdmin() ? '' : '<a class="item" href="javascript:void 0" id="mFb">' + icon('send', 'chev') + '<div class="grow t">Gửi góp ý cho quản trị</div></a>') +
        '<a class="item" href="index.html" target="_blank">' + icon('link', 'chev') + '<div class="grow t">Mở trang tra điểm</div></a>' +
        '<a class="item" href="javascript:void 0" id="mLogout" style="color:var(--red)">' + icon('logout', 'chev') + '<div class="grow t">Đăng xuất</div></a></div>'
    });
    $$('a[href^="#"]', m.el).forEach(function (a) { a.addEventListener('click', function () { m.close(); }); });
    m.$('#mChangePw').onclick = function () { m.close(); changePasswordModal(false); };
    if (m.$('#mFb')) m.$('#mFb').onclick = function () { m.close(); feedbackModal(); };
    m.$('#mLogout').onclick = function () { m.close(); logout(); };
  };
}
function updateGopYBadge(n) {
  App.state.gopYMoi = n;
  var a = $('.nav-item[data-nav="gop-y"]');
  if (a) { var c = a.querySelector('.count'); if (n) { if (!c) { c = document.createElement('b'); c.className = 'count'; a.appendChild(c); } c.textContent = n; } else if (c) c.remove(); }
}

async function logout() {
  try { await Api.call('logout', {}, { silent: true }); } catch (e) {}
  Session.clear(); Api.invalidate();
  location.hash = '';
  showLogin();
  toast('Đã đăng xuất', 'success');
}

/* ---------------- đăng nhập ---------------- */
function showLogin() {
  var root = document.getElementById('root');
  root.innerHTML = '<div class="login"><form class="login-card" id="loginForm" novalidate>' +
    '<div class="brand"><i class="mark"></i>Sổ điểm</div>' +
    '<h1>Đăng nhập</h1><p class="muted" style="margin-bottom:20px">Dành cho giáo viên và quản trị. Học sinh xem điểm ở <a href="index.html">trang tra điểm</a>.</p>' +
    '<div class="stack"><div class="field"><label for="lu">Tài khoản</label><input class="input" id="lu" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>' +
    '<div class="field"><label for="lp">Mật khẩu</label><div style="position:relative"><input class="input" id="lp" type="password" autocomplete="current-password" required style="padding-right:46px">' +
    '<button type="button" class="btn btn-ghost btn-icon btn-sm" id="lpEye" aria-label="Hiện mật khẩu" style="position:absolute;right:5px;top:5px">' + icon('eye') + '</button></div>' +
    '<div class="err hidden" id="lcaps">Đang bật Caps Lock</div></div>' +
    '<div class="err hidden" id="lerr" role="alert"></div>' +
    '<button class="btn btn-primary btn-lg" id="lbtn" type="submit"><span>Đăng nhập</span></button>' +
    '<button type="button" class="btn btn-ghost" id="lforgot"><span>Quên mật khẩu?</span></button></div></form></div>';
  var f = $('#loginForm'), err = $('#lerr');
  $('#lu').focus();
  $('#lpEye').onclick = function () { var p = $('#lp'), s = p.type === 'password'; p.type = s ? 'text' : 'password'; this.innerHTML = icon(s ? 'eyeOff' : 'eye'); };
  $('#lp').addEventListener('keyup', function (e) { $('#lcaps').classList.toggle('hidden', !(e.getModifierState && e.getModifierState('CapsLock'))); });
  $('#lforgot').onclick = function () { forgotModal($('#lu').value.trim()); };
  f.onsubmit = function (e) {
    e.preventDefault();
    var username = $('#lu').value.trim(), password = $('#lp').value;
    err.classList.add('hidden');
    if (!username || !password) { err.textContent = 'Nhập tài khoản và mật khẩu'; err.classList.remove('hidden'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
    busy($('#lbtn'), async function () {
      var r = await Api.call('login', { username: username, password: password }, { noAuth: true });
      Session.set(r.token, r.user);
      await loadShell();
    }, { silent: true, rethrow: true }).catch(function (e2) {
      err.textContent = e2.message; err.classList.remove('hidden');
      f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    });
  };
}

function forgotModal(prefill) {
  var m = Modal.open({
    title: 'Lấy lại mật khẩu',
    body: '<div class="stack"><p class="muted">Mã 6 số sẽ được gửi tới email của tài khoản (quản trị nhập email cho từng tài khoản). Tài khoản chưa có email thì nhờ quản trị đặt lại mật khẩu.</p>' +
      '<div class="field"><label>Tài khoản</label><input class="input" id="fu" value="' + esc(prefill || '') + '" autocapitalize="off"></div>' +
      '<div id="fstep2" class="stack hidden"><div class="field"><label>Mã trong email</label><input class="input" id="fc" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>' +
      '<div class="field"><label>Mật khẩu mới (ít nhất 6 ký tự)</label><input class="input" id="fp" type="password" autocomplete="new-password"></div></div></div>',
    actions: [
      { label: 'Gửi mã', kind: '', id: 'fsend', onClick: async function (c) {
        var u = c.$('#fu').value.trim();
        if (!u) { toast('Nhập tên tài khoản', 'error'); return; }
        var r = await Api.call('quenMatKhau', { username: u }, { noAuth: true });
        toast(r.msg, 'success', 6000);
        c.$('#fstep2').classList.remove('hidden'); c.$('#fc').focus(); c.$('#fset').classList.remove('hidden');
      } },
      { label: 'Đặt mật khẩu mới', kind: 'btn-primary hidden', id: 'fset', onClick: async function (c) {
        await Api.call('datLaiMatKhau', { username: c.$('#fu').value.trim(), code: c.$('#fc').value.trim(), newPassword: c.$('#fp').value }, { noAuth: true });
        c.close(); toast('Đã đặt mật khẩu mới. Hãy đăng nhập.', 'success');
      } }
    ]
  });
  m.$('#fset').classList.add('hidden');
}

function changePasswordModal(forced) {
  return new Promise(function (resolve) {
    Modal.open({
      title: forced ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu', dismissible: !forced, onClose: resolve,
      body: (forced ? '<div class="note blue" style="margin-bottom:14px">' + icon('info') + '<div>Đây là lần đăng nhập đầu tiên với mật khẩu tạm. Hãy đặt mật khẩu của riêng bạn.</div></div>' : '') +
        '<div class="stack"><div class="field"><label>Mật khẩu hiện tại</label><input class="input" id="cpo" type="password" autocomplete="current-password"></div>' +
        '<div class="field"><label>Mật khẩu mới</label><input class="input" id="cpn" type="password" autocomplete="new-password"><div class="hint">Ít nhất 6 ký tự. Các máy khác đang đăng nhập sẽ bị đăng xuất.</div></div>' +
        '<div class="field"><label>Nhập lại mật khẩu mới</label><input class="input" id="cpn2" type="password" autocomplete="new-password"></div></div>',
      actions: (forced ? [] : [{ label: 'Hủy', kind: 'btn-ghost' }]).concat([{ label: 'Lưu mật khẩu', kind: 'btn-primary', onClick: async function (c) {
        var n = c.$('#cpn').value;
        if (n !== c.$('#cpn2').value) { c.$('#cpn2').classList.add('is-bad'); throw ApiError('ERR', 'Hai lần nhập mật khẩu mới không giống nhau'); }
        var r = await Api.call('changePassword', { oldPassword: c.$('#cpo').value, newPassword: n });
        if (r.token) Session.setToken(r.token);
        var u = Session.user() || {}; u.mustChange = false; Session.set(Session.token(), u);
        c.close(true); toast('Đã đổi mật khẩu', 'success');
      } }])
    });
  });
}
function forceChangePassword() { changePasswordModal(true); }

function feedbackModal() {
  Modal.open({
    title: 'Gửi góp ý cho quản trị',
    body: '<div class="field"><label>Nội dung</label><textarea class="input" id="fbn" placeholder="Ví dụ: muốn thêm nút in bảng điểm, hoặc báo lỗi gặp phải…"></textarea></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Gửi', kind: 'btn-primary', icon: 'send', onClick: async function (c) {
      await Api.call('guiGopY', { noiDung: c.$('#fbn').value });
      c.close(); toast('Đã gửi góp ý', 'success');
    } }]
  });
}
async function errorLogModal() {
  var m = Modal.open({ title: 'Nhật ký lỗi hệ thống', size: 'lg', body: '<div class="sk sk-line"></div><div class="sk sk-line"></div>' });
  try {
    var r = await Api.call('nhatKyLoi');
    m.setBody(r.loi.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>' +
      r.loi.map(function (l) { return '<tr><td class="small muted" style="white-space:nowrap">' + esc(l.thoiGian) + '</td><td>' + esc(l.action) + '</td><td class="small" style="word-break:break-word">' + esc(l.message.slice(0, 400)) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : emptyState('okc', 'Không có lỗi nào', 'Hệ thống chưa ghi nhận lỗi lập trình nào.'));
  } catch (e) { m.close(); toastErr(e); }
}

/* ---------------- TỔNG QUAN ---------------- */
function greet() { var h = new Date().getHours(); return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'; }

async function screenHome() {
  var v = V();
  var draw = function () {
    var S = App.state, bai = S.bai.filter(function (b) { return !b.luuTru; });
    var cho = bai.reduce(function (s, b) { return s + (b.soChoXuLy || 0); }, 0);
    var chuaDiem = bai.filter(function (b) { return !b.soKetQua; });
    var chuaCongBo = bai.filter(function (b) { return b.soKetQua && b.trangThai !== 'Đã công bố'; });
    var daCongBo = bai.filter(function (b) { return b.trangThai === 'Đã công bố'; });
    var todo = [];
    bai.filter(function (b) { return b.soChoXuLy; }).forEach(function (b) { todo.push({ b: b, ico: 'alert', cls: 'warn', t: b.soChoXuLy + ' dòng điểm chưa gán cho học sinh', href: '#/bai/' + b.maBai + '/ket-qua/cho' }); });
    chuaCongBo.forEach(function (b) { todo.push({ b: b, ico: 'eye', cls: 'blue', t: 'Đã có điểm, chưa công bố', href: '#/bai/' + b.maBai + '/ket-qua' }); });
    chuaDiem.slice(0, 5).forEach(function (b) { todo.push({ b: b, ico: 'upload', cls: '', t: 'Chưa nhập điểm', href: '#/bai/' + b.maBai }); });
    swap(v, '<div class="page">' +
      '<div class="page-head"><div class="titles"><h1>' + greet() + ', ' + esc(S.user.fullName || S.user.username) + '</h1><div class="sub">' + (bai.length ? 'Đang có ' + bai.length + ' bài kiểm tra.' : 'Chưa có bài kiểm tra nào.') + '</div></div>' +
      (isAdmin() ? '' : '<a class="btn btn-primary" href="#/bai/moi">' + icon('plus') + '<span>Tạo bài mới</span></a>') + '</div>' +
      '<div class="grid grid-4 stagger" style="margin-bottom:18px">' +
      '<a class="kpi kpi-link" href="#/bai"><div class="v" data-n="' + bai.length + '">0</div><div class="l">Bài đang có</div></a>' +
      '<a class="kpi kpi-link ' + (cho ? 'amber' : '') + '" href="#/bai"><div class="v" data-n="' + cho + '">0</div><div class="l">Dòng điểm chờ xử lý</div></a>' +
      '<a class="kpi kpi-link blue" href="#/bai"><div class="v" data-n="' + chuaCongBo.length + '">0</div><div class="l">Bài có điểm, chưa công bố</div></a>' +
      (isAdmin() ? '<a class="kpi kpi-link ' + (S.gopYMoi ? 'red' : '') + '" href="#/gop-y"><div class="v" data-n="' + S.gopYMoi + '">0</div><div class="l">Góp ý mới</div></a>'
        : '<a class="kpi kpi-link green" href="#/bai"><div class="v" data-n="' + daCongBo.length + '">0</div><div class="l">Bài đã công bố</div></a>') + '</div>' +
      '<div class="grid grid-2">' +
      '<div class="panel"><div class="panel-head"><h3>Việc cần làm</h3></div>' + (todo.length ? '<div class="list">' + todo.slice(0, 8).map(function (t) {
        return '<a class="item" href="' + t.href + '"><span class="badge ' + t.cls + ' plain" style="padding:6px">' + icon(t.ico) + '</span><div class="grow"><div class="t">' + esc(t.b.tenBai) + '</div><div class="s">' + esc(t.t) + '</div></div>' + icon('chevR', 'chev') + '</a>';
      }).join('') + '</div>' : emptyState('okc', 'Không có việc tồn', 'Mọi bài đều đã có điểm và đã công bố.')) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Bài gần đây</h3><a class="btn btn-ghost btn-sm" href="#/bai"><span>Xem tất cả</span></a></div>' + (bai.length ? '<div class="list">' + bai.slice(0, 6).map(baiItemHtml).join('') + '</div>' :
        emptyState('sheet', 'Chưa có bài nào', 'Tạo bài đầu tiên để bắt đầu.', isAdmin() ? '' : '<a class="btn btn-primary" href="#/bai/moi">' + icon('plus') + '<span>Tạo bài mới</span></a>')) + '</div>' +
      '</div></div>');
    $$('.kpi .v[data-n]', v).forEach(function (el) { countUp(el, Number(el.dataset.n), 700, 0); });
  };
  draw();
  Api.swr('listBai', {}, function (d) { App.state.bai = d.bai; draw(); }).catch(toastErr);
}

/* dùng chung cho danh sách bài */
function trangThaiBadge(b) {
  if (b.luuTru) return '<span class="badge">Lưu trữ</span>';
  if (b.trangThai === 'Đã công bố') return '<span class="badge ok">Đã công bố</span>';
  if (b.soKetQua || b.trangThai === 'Đã nhập điểm') return '<span class="badge blue">Đã có điểm</span>';
  return '<span class="badge">Chưa có điểm</span>';
}
function baiItemHtml(b) {
  return '<a class="item" href="#/bai/' + esc(b.maBai) + '"><div class="grow"><div class="t">' + esc(b.tenBai) + '</div>' +
    '<div class="s">' + (b.ngay ? fmtDate(b.ngay) + ', ' : '') + (b.cacNhom.length ? 'nhóm ' + b.cacNhom.map(esc).join(', ') : 'chưa chọn nhóm') +
    (isAdmin() ? ', ' + esc(b.teacher) : '') + (b.soKetQua ? ', ' + b.soKetQua + ' kết quả' : '') + '</div></div>' +
    '<div class="right">' + (b.soChoXuLy ? '<span class="badge warn">' + b.soChoXuLy + ' chờ</span>' : '') + trangThaiBadge(b) + icon('chevR', 'chev') + '</div></a>';
}

/* ---------------- LỚP VÀ HỌC SINH ---------------- */
async function screenRoster(params) {
  var v = V();
  var ma = params.ma || '';
  var state = { groups: App.state.groups, students: null, q: '' };
  var shell = function () {
    var g = state.groups.find(function (x) { return x.maNhom === ma; });
    return '<div class="page"><div class="page-head"><div class="titles"><h1>Lớp và học sinh</h1><div class="sub">Sửa ở đây thì file Google Sheet đổi theo và ngược lại.</div></div>' +
      '<div class="row">' + (isAdmin() ? '' : '<button class="btn" id="rSync">' + icon('refresh') + '<span>Đồng bộ nhóm</span></button>') +
      '<button class="btn" id="rCheck">' + icon('okc') + '<span>Kiểm tra danh sách</span></button></div></div>' +
      (state.groups.length ? '<div class="seg" style="margin-bottom:14px" id="rGroups">' + state.groups.map(function (x) {
        return '<button data-ma="' + esc(x.maNhom) + '" class="' + (x.maNhom === ma ? 'active' : '') + '">' + esc(x.tenNhom) + '<span class="n">' + x.active + '</span></button>';
      }).join('') + '</div>' : '') +
      '<div id="rBody">' + (state.groups.length ? '' : emptyState('users', 'Chưa có nhóm nào', isAdmin() ? 'Thêm tài khoản giáo viên với file danh sách, rồi bấm Đồng bộ.' : 'Bấm "Đồng bộ nhóm" để quét các tab trong file danh sách của bạn.')) + '</div></div>';
  };
  if (!ma && state.groups.length) { ma = state.groups[0].maNhom; history.replaceState(null, '', '#/lop/' + ma); Router.cur = '/lop/' + ma; }
  swap(v, shell());
  var bind = function () {
    $$('#rGroups button').forEach(function (b) { b.onclick = function () { Router.go('/lop/' + b.dataset.ma); }; });
    if ($('#rSync')) $('#rSync').onclick = function () {
      busy(this, async function () {
        var r = await Api.call('syncGroups');
        var gr = await Api.call('listGroups', { fresh: true });
        App.state.groups = gr.groups;
        Modal.open({ title: 'Kết quả đồng bộ', body: '<p><b>Đã nhận ' + r.registered.length + ' nhóm:</b> ' + (r.registered.map(function (x) { return esc(x.tenNhom) + ' (' + x.maNhom + ')'; }).join(', ') || 'không có') + '</p>' +
          (r.conflicts.length ? '<div class="note warn" style="margin-top:12px">' + icon('alert') + '<div><b>Bỏ qua:</b><br>' + r.conflicts.map(function (x) { return esc(x.tenNhom) + ' (' + x.maNhom + '): ' + esc(x.lyDo); }).join('<br>') + '</div></div>' : ''),
          actions: [{ label: 'Đóng', kind: 'btn-primary' }] });
        screenRoster({ ma: ma });
      });
    };
    $('#rCheck').onclick = function () {
      busy(this, async function () {
        var r = await Api.call('validateRoster');
        Modal.open({ title: 'Kiểm tra danh sách', size: 'lg', body: r.ok ? emptyState('okc', 'Không có vấn đề', 'Danh sách hợp lệ: không trùng SBD, không thiếu tên.') :
          '<div class="table-wrap"><table class="tbl"><thead><tr><th>Vấn đề</th><th>Nhóm</th><th>Chi tiết</th></tr></thead><tbody>' +
          r.issues.map(function (i) { return '<tr><td><span class="badge warn">' + esc(i.type) + '</span></td><td>' + esc(i.group) + '</td><td>' + esc(i.detail) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p class="small muted" style="margin-top:10px">Sửa trực tiếp trong file Google Sheet danh sách, rồi bấm "Kiểm tra" lại.</p>', actions: [{ label: 'Đóng', kind: 'btn-primary' }] });
      });
    };
  };
  bind();
  if (!ma) return;
  var body = $('#rBody');
  body.innerHTML = '<div class="panel">' + [1, 2, 3, 4, 5, 6].map(function () { return '<div class="sk sk-line"></div>'; }).join('') + '</div>';
  var load = async function (fresh) {
    var r = await Api.call('listStudents', { maNhom: ma, fresh: !!fresh });
    state.students = r.students;
    drawTable(r);
  };
  var drawTable = function (r) {
    var q = state.q.toLowerCase();
    var list = r.students.filter(function (s) { return !q || (s.sbd + ' ' + s.ho + ' ' + s.ten).toLowerCase().indexOf(q) !== -1; });
    if (window.matchMedia && window.matchMedia('(max-width: 860px)').matches) return drawCards(r, list);
    body.innerHTML = '<div class="panel"><div class="panel-head"><h3>' + esc(r.tenNhom) + ' <span class="muted" style="font-weight:500">(' + r.students.length + ' em)</span></h3>' +
      '<input class="input input-sm" id="rq" placeholder="Tìm tên hoặc SBD" value="' + esc(state.q) + '" style="max-width:220px">' +
      '<button class="btn btn-sm" id="rReload">' + icon('refresh') + '<span class="hide-m">Tải lại</span></button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>SBD</th><th>Họ</th><th>Tên</th><th class="hide-m">Lớp</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      list.map(function (s) {
        var dim = s.trangThai !== 'Đang học';
        return '<tr data-sbd="' + esc(s.sbd) + '" class="' + (dim ? 'dim' : '') + '"><td class="sbd">' + esc(s.sbd) + (s.sbdCu ? '<div class="small muted">cũ: ' + esc(s.sbdCu) + '</div>' : '') + '</td>' +
          '<td><input class="input input-sm f-ho" value="' + esc(s.ho) + '"></td><td><input class="input input-sm f-ten" value="' + esc(s.ten) + '" style="max-width:130px"></td>' +
          '<td class="hide-m"><input class="input input-sm f-lop" value="' + esc(s.lop) + '" style="max-width:70px"></td>' +
          '<td><select class="input input-sm f-tt">' + ['Đang học', 'Đã nghỉ'].concat(s.trangThai === 'Đã chuyển' ? ['Đã chuyển'] : []).map(function (o) { return '<option ' + (o === s.trangThai ? 'selected' : '') + '>' + o + '</option>'; }).join('') + '</select></td>' +
          '<td class="act"><button class="btn btn-sm btn-primary f-save hidden">' + icon('check') + '<span>Lưu</span></button>' +
          '<button class="btn btn-sm btn-ghost f-tr" title="Chuyển nhóm">' + icon('swap') + '<span class="hide-m">Chuyển</span></button></td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td class="muted small">tự cấp</td><td><input class="input input-sm" id="nh" placeholder="Họ"></td><td><input class="input input-sm" id="nt" placeholder="Tên"></td>' +
      '<td class="hide-m"><input class="input input-sm" id="nl" placeholder="Lớp" style="max-width:70px"></td><td></td><td class="act"><button class="btn btn-sm btn-primary" id="nAdd">' + icon('plus') + '<span>Thêm em</span></button></td></tr></tfoot></table></div></div>';
    $('#rq').oninput = debounce(function () { state.q = $('#rq').value; drawTable(r); $('#rq').focus(); var x = $('#rq'); x.setSelectionRange(x.value.length, x.value.length); }, 200);
    $('#rReload').onclick = function () { busy(this, function () { return load(true); }); };
    $$('tbody tr', body).forEach(function (tr) {
      var sbd = tr.dataset.sbd, save = tr.querySelector('.f-save');
      $$('.f-ho, .f-ten, .f-lop', tr).forEach(function (i) { i.addEventListener('input', function () { save.classList.remove('hidden'); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter') save.click(); }); });
      save.onclick = function () {
        busy(save, async function () {
          await Api.call('upsertStudent', { maNhom: ma, sbd: sbd, ho: tr.querySelector('.f-ho').value, ten: tr.querySelector('.f-ten').value, lop: tr.querySelector('.f-lop').value });
          save.classList.add('hidden'); tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
        }, { ok: 'Đã lưu ' + sbd });
      };
      tr.querySelector('.f-tt').onchange = function () {
        var sel = this;
        busy(null, async function () { await Api.call('setStudentStatus', { maNhom: ma, sbd: sbd, trangThai: sel.value }); tr.classList.toggle('dim', sel.value !== 'Đang học'); }, { ok: 'Đã đổi trạng thái' });
      };
      tr.querySelector('.f-tr').onclick = function () { transferModal(ma, sbd, function () { load(true); }); };
    });
    $('#nAdd').onclick = function () {
      var b = this;
      busy(b, async function () {
        var res = await Api.call('upsertStudent', { maNhom: ma, ho: $('#nh').value, ten: $('#nt').value, lop: $('#nl').value });
        toast('Đã thêm, SBD ' + res.sbd, 'success');
        await load(true);
      });
    };
  };
  /* điện thoại: danh sách thẻ, chạm vào một em để sửa trong form ô to */
  var drawCards = function (r, list) {
    body.innerHTML = '<div class="panel" style="padding:14px"><div class="row" style="margin-bottom:10px"><h3 class="grow">' + esc(r.tenNhom) + ' <span class="muted" style="font-weight:500">(' + r.students.length + ')</span></h3>' +
      '<button class="btn btn-sm" id="rReload" aria-label="Tải lại">' + icon('refresh') + '</button><button class="btn btn-sm btn-primary" id="mAdd">' + icon('plus') + '<span>Thêm em</span></button></div>' +
      '<input class="input" id="rq" placeholder="Tìm tên hoặc SBD" value="' + esc(state.q) + '" type="search"></div>' +
      '<div class="panel" style="padding:0;overflow:hidden;margin-top:12px"><div class="list">' + (list.length ? list.map(function (s) {
        return '<a class="item" href="javascript:void 0" data-sbd="' + esc(s.sbd) + '" style="' + (s.trangThai !== 'Đang học' ? 'opacity:.6' : '') + '"><div class="grow"><div class="t">' + esc(((s.ho || '') + ' ' + (s.ten || '')).trim() || '(chưa có tên)') + '</div>' +
          '<div class="s"><span class="sbd">' + esc(s.sbd) + '</span>' + (s.lop ? ', lớp ' + esc(s.lop) : '') + (s.sbdCu ? ', SBD cũ ' + esc(s.sbdCu) : '') + '</div></div>' +
          (s.trangThai !== 'Đang học' ? '<span class="badge">' + esc(s.trangThai) + '</span>' : '') + icon('chevR', 'chev') + '</a>';
      }).join('') : emptyState('search', 'Không có em nào khớp', '')) + '</div></div>';
    $('#rq').oninput = debounce(function () { state.q = $('#rq').value; drawTable(r); var x = $('#rq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250);
    $('#rReload').onclick = function () { busy(this, function () { return load(true); }); };
    $('#mAdd').onclick = function () { studentModal(ma, null, function () { return load(true); }); };
    $$('.list .item[data-sbd]', body).forEach(function (a) { a.onclick = function () { var s = r.students.find(function (x) { return x.sbd === a.dataset.sbd; }); if (s) studentModal(ma, s, function () { return load(true); }); }; });
  };
  try { await load(false); } catch (e) { body.innerHTML = '<div class="panel">' + emptyState('alert', 'Không tải được danh sách', e.message) + '</div>'; }
}

/** Form sửa / thêm một học sinh (dùng trên điện thoại) */
function studentModal(ma, s, after) {
  var isNew = !s; s = s || {};
  var m = Modal.open({
    title: isNew ? 'Thêm học sinh' : ((s.ho || '') + ' ' + (s.ten || '')).trim() || ('SBD ' + s.sbd),
    body: '<div class="stack">' + (isNew ? '<p class="small muted">SBD tự cấp tiếp theo trong nhóm.</p>' : '<p class="small muted">SBD <b class="sbd">' + esc(s.sbd) + '</b>' + (s.sbdCu ? ', SBD cũ ' + esc(s.sbdCu) : '') + '</p>') +
      '<div class="field"><label>Họ và tên đệm</label><input class="input" id="sh" value="' + esc(s.ho || '') + '" autocomplete="off"></div>' +
      '<div class="field"><label>Tên</label><input class="input" id="st" value="' + esc(s.ten || '') + '" autocomplete="off"></div>' +
      '<div class="field"><label>Lớp ở trường</label><input class="input" id="sl" value="' + esc(s.lop || '') + '" autocomplete="off"></div>' +
      (isNew ? '' : '<div class="field"><label>Trạng thái</label><select class="input" id="stt">' + ['Đang học', 'Đã nghỉ'].concat(s.trangThai === 'Đã chuyển' ? ['Đã chuyển'] : []).map(function (o) { return '<option ' + (o === s.trangThai ? 'selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>') +
      (isNew ? '' : '<button class="btn btn-ghost" id="sTr" style="align-self:flex-start">' + icon('swap') + '<span>Chuyển sang nhóm khác</span></button>') + '</div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: isNew ? 'Thêm em' : 'Lưu', kind: 'btn-primary', onClick: async function (c) {
      var r = await Api.call('upsertStudent', { maNhom: ma, sbd: isNew ? undefined : s.sbd, ho: c.$('#sh').value, ten: c.$('#st').value, lop: c.$('#sl').value });
      if (!isNew && c.$('#stt').value !== s.trangThai) await Api.call('setStudentStatus', { maNhom: ma, sbd: s.sbd, trangThai: c.$('#stt').value });
      c.close(); toast(isNew ? 'Đã thêm, SBD ' + r.sbd : 'Đã lưu ' + s.sbd, 'success');
      if (after) await after();
    } }]
  });
  if (m.$('#sTr')) m.$('#sTr').onclick = function () { m.close(); transferModal(ma, s.sbd, after); };
}

function transferModal(fromMa, sbd, after) {
  var others = App.state.groups.filter(function (g) { return g.maNhom !== fromMa; });
  if (!others.length) { toast('Không có nhóm khác để chuyển', 'error'); return; }
  Modal.open({
    title: 'Chuyển nhóm cho SBD ' + sbd,
    body: '<p class="muted" style="margin-bottom:12px">Em được cấp SBD mới ở nhóm mới. SBD cũ được giữ làm lịch sử, nên em vẫn xem được điểm các bài cũ.</p>' +
      '<div class="field"><label>Chuyển sang nhóm</label><select class="input" id="trTo">' + others.map(function (g) { return '<option value="' + esc(g.maNhom) + '">' + esc(g.tenNhom) + ' (' + g.maNhom + ')</option>'; }).join('') + '</select></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Chuyển nhóm', kind: 'btn-primary', onClick: async function (c) {
      var r = await Api.call('transferStudent', { fromMaNhom: fromMa, sbd: sbd, toMaNhom: c.$('#trTo').value });
      c.close(); toast('Đã chuyển, SBD mới ' + r.newSbd, 'success'); after && after();
    } }]
  });
}

/* ---------------- TÀI KHOẢN (quản trị) ---------------- */
async function screenAccounts() {
  var v = V();
  swap(v, skPage());
  var draw = function (users) {
    var p3 = function (n) { return n === '' || n === null || n === undefined ? '' : ('00' + parseInt(n, 10)).slice(-3); };
    swap(v, '<div class="page"><div class="page-head"><div class="titles"><h1>Tài khoản</h1><div class="sub">Mỗi giáo viên có file danh sách và dải mã SBD riêng, không xem được của nhau.</div></div>' +
      '<button class="btn btn-primary" id="uNew">' + icon('plus') + '<span>Thêm tài khoản</span></button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tài khoản</th><th>Họ tên</th><th class="hide-m">Email</th><th>Vai trò</th><th class="hide-m">Dải mã</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr data-u="' + esc(u.username) + '"><td><b>' + esc(u.username) + '</b></td><td>' + esc(u.fullName) + '</td><td class="hide-m small">' + (u.email ? esc(u.email) : '<span class="muted">chưa có</span>') + '</td>' +
          '<td>' + (u.role === 'admin' ? '<span class="badge blue plain">Quản trị</span>' : '<span class="badge plain">Giáo viên</span>') + '</td>' +
          '<td class="hide-m sbd">' + (u.role === 'teacher' && u.rangeStart !== '' ? p3(u.rangeStart) + '–' + p3(u.rangeEnd) : '—') + '</td>' +
          '<td>' + (u.active ? '<span class="badge ok">Hoạt động</span>' : '<span class="badge red">Đã khóa</span>') + (u.mustChange ? ' <span class="badge warn plain">MK tạm</span>' : '') + '</td>' +
          '<td class="act"><div class="menu"><button class="btn btn-ghost btn-icon btn-sm u-more" aria-label="Thao tác">' + icon('more') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div></div>');
    $('#uNew').onclick = function () { userModal(null, function () { screenAccounts(); }); };
    $$('.u-more').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var un = b.closest('tr').dataset.u, u = users.find(function (x) { return x.username === un; });
        var items = [{ label: 'Sửa thông tin', icon: 'pen', onClick: function () { userModal(u, function () { screenAccounts(); }); } }];
        if (u.role === 'teacher') items.push({ label: 'Đồng bộ nhóm từ file', icon: 'refresh', onClick: function () {
          busy(null, async function () { var r = await Api.call('syncGroups', { username: un }); toast('Đã nhận ' + r.registered.length + ' nhóm' + (r.conflicts.length ? ', bỏ qua ' + r.conflicts.length : ''), r.conflicts.length ? 'warn' : 'success'); });
        } });
        items.push({ label: 'Đặt lại mật khẩu', icon: 'key', onClick: async function () {
          if (!(await Modal.confirm({ title: 'Đặt lại mật khẩu cho ' + un + '?', message: 'Tài khoản sẽ phải đăng nhập lại bằng mật khẩu tạm và đặt mật khẩu mới.', confirmText: 'Đặt lại' }))) return;
          busy(null, async function () {
            var r = await Api.call('resetPassword', { username: un });
            Modal.open({ title: 'Mật khẩu tạm', body: '<p>Gửi cho người dùng mật khẩu tạm sau. Lần đăng nhập đầu sẽ phải đổi.</p><div class="row" style="margin-top:12px"><code class="input" style="flex:1;font-weight:700">' + esc(r.tempPassword) + '</code><button class="btn" id="cpy">' + icon('copy') + '<span>Chép</span></button></div>', actions: [{ label: 'Xong', kind: 'btn-primary' }] });
            $('#cpy').onclick = function () { try { navigator.clipboard.writeText(r.tempPassword); toast('Đã chép', 'success'); } catch (e) {} };
          });
        } });
        items.push('-', { label: u.active ? 'Khóa tài khoản' : 'Mở khóa', icon: 'lock', danger: u.active, onClick: async function () {
          if (u.active && !(await Modal.confirm({ title: 'Khóa ' + un + '?', message: 'Tài khoản bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa.', confirmText: 'Khóa', danger: true }))) return;
          busy(null, async function () { await Api.call('setUserActive', { username: un, active: !u.active }); screenAccounts(); }, { ok: u.active ? 'Đã khóa' : 'Đã mở khóa' });
        } });
        popMenu(b, items);
      };
    });
  };
  try { draw((await Api.call('listUsers')).users); } catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không tải được', e.message) + '</div>'); }
}

function userModal(u, after) {
  var isNew = !u; u = u || { role: 'teacher' };
  var m = Modal.open({
    title: isNew ? 'Thêm tài khoản' : 'Sửa: ' + u.username, size: 'lg',
    body: '<div class="grid grid-2">' +
      (isNew ? '<div class="field"><label>Tên đăng nhập</label><input class="input" id="uu" autocapitalize="off" placeholder="vd: co.lan"><div class="hint">Chữ không dấu, số, dấu chấm, gạch</div></div>' +
        '<div class="field"><label>Vai trò</label><select class="input" id="ur"><option value="teacher">Giáo viên</option><option value="admin">Quản trị</option></select></div>' : '') +
      '<div class="field"><label>Họ tên</label><input class="input" id="un" value="' + esc(u.fullName || '') + '"></div>' +
      '<div class="field"><label>Email (để tự lấy lại mật khẩu)</label><input class="input" id="ue" type="email" value="' + esc(u.email || '') + '"></div>' +
      '<div class="field t-only" style="grid-column:1/-1"><label>ID file danh sách lớp</label><input class="input" id="ux" value="' + esc(u.rosterSheetId || '') + '" placeholder="phần giữa /d/ và /edit trong link Google Sheet">' +
      '<div class="hint">Nhớ chia sẻ quyền sửa file đó cho tài khoản Google chạy hệ thống.</div></div>' +
      '<div class="field t-only"><label>Dải mã từ</label><input class="input" id="us" type="number" min="0" max="999" value="' + esc(u.rangeStart === undefined ? '' : u.rangeStart) + '" placeholder="200"></div>' +
      '<div class="field t-only"><label>đến</label><input class="input" id="ut" type="number" min="0" max="999" value="' + esc(u.rangeEnd === undefined ? '' : u.rangeEnd) + '" placeholder="299"></div></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: isNew ? 'Tạo tài khoản' : 'Lưu', kind: 'btn-primary', onClick: async function (c) {
      var data = { fullName: c.$('#un').value, email: c.$('#ue').value, rosterSheetId: c.$('#ux').value, rangeStart: c.$('#us').value, rangeEnd: c.$('#ut').value };
      if (isNew) {
        data.username = c.$('#uu').value; data.role = c.$('#ur').value;
        var r = await Api.call('createUser', data);
        c.close();
        Modal.open({ title: 'Đã tạo tài khoản', body: '<p>Đăng nhập lần đầu bằng mật khẩu tạm <b>' + esc(r.tempPassword) + '</b> và sẽ phải đổi.</p>' + (data.role === 'teacher' ? '<p class="muted" style="margin-top:8px">Tiếp theo: bấm ••• ở dòng tài khoản này, chọn "Đồng bộ nhóm từ file".</p>' : ''), actions: [{ label: 'Xong', kind: 'btn-primary' }] });
      } else {
        data.username = u.username;
        await Api.call('setUserInfo', data);
        c.close(); toast('Đã lưu', 'success');
      }
      after && after();
    } }]
  });
  var role = function () { var r = m.$('#ur') ? m.$('#ur').value : u.role; m.$$('.t-only').forEach(function (x) { x.classList.toggle('hidden', r !== 'teacher'); }); };
  if (m.$('#ur')) m.$('#ur').onchange = role;
  role();
}

/* ---------------- GÓP Ý (quản trị) ---------------- */
async function screenFeedback() {
  var v = V(), filter = 'moi';
  swap(v, skPage());
  var data = [];
  var draw = function () {
    var list = data.filter(function (g) { return filter === 'all' || (filter === 'moi' ? !g.daXuLy : g.daXuLy); });
    var n = { moi: data.filter(function (g) { return !g.daXuLy; }).length, xong: data.filter(function (g) { return g.daXuLy; }).length };
    swap(v, '<div class="page"><div class="page-head"><div class="titles"><h1>Góp ý và báo lỗi</h1><div class="sub">Từ trang tra điểm và từ giáo viên.</div></div></div>' +
      '<div class="seg" id="fseg" style="margin-bottom:14px"><button data-f="moi" class="' + (filter === 'moi' ? 'active' : '') + '">Mới<span class="n">' + n.moi + '</span></button>' +
      '<button data-f="xong" class="' + (filter === 'xong' ? 'active' : '') + '">Đã xử lý<span class="n">' + n.xong + '</span></button><button data-f="all" class="' + (filter === 'all' ? 'active' : '') + '">Tất cả</button></div>' +
      (list.length ? '<div class="stack stagger">' + list.map(function (g) {
        return '<div class="panel" data-id="' + esc(g.id) + '"><div class="row" style="margin-bottom:8px"><span class="badge ' + (g.daXuLy ? 'ok' : 'warn') + '">' + (g.daXuLy ? 'Đã xử lý' : 'Mới') + '</span>' +
          '<span class="small muted">' + esc(g.thoiGian) + ', từ ' + esc(g.nguon || 'không rõ') + (g.nguoiGui ? ' (' + esc(g.nguoiGui) + ')' : '') + (g.sbd ? ', SBD ' + esc(g.sbd) : '') + '</span></div>' +
          '<p style="white-space:pre-wrap">' + esc(g.noiDung) + '</p>' + (g.lienHe ? '<p class="small muted" style="margin-top:6px">Liên hệ: ' + esc(g.lienHe) + '</p>' : '') +
          '<div class="row" style="margin-top:12px"><button class="btn btn-sm g-toggle">' + icon(g.daXuLy ? 'refresh' : 'check') + '<span>' + (g.daXuLy ? 'Đánh dấu chưa xử lý' : 'Đánh dấu đã xử lý') + '</span></button>' +
          '<button class="btn btn-sm btn-ghost g-del">' + icon('trash') + '<span>Xóa</span></button></div></div>';
      }).join('') + '</div>' : emptyState('inbox', filter === 'moi' ? 'Không có góp ý mới' : 'Chưa có góp ý', 'Góp ý gửi từ trang tra điểm sẽ hiện ở đây, kèm email báo cho bạn.')) + '</div>');
    $$('#fseg button').forEach(function (b) { b.onclick = function () { filter = b.dataset.f; draw(); }; });
    $$('.g-toggle').forEach(function (b) {
      b.onclick = function () {
        var id = b.closest('[data-id]').dataset.id, g = data.find(function (x) { return x.id === id; });
        busy(b, async function () { await Api.call('xuLyGopY', { id: id, daXuLy: !g.daXuLy }); g.daXuLy = !g.daXuLy; updateGopYBadge(data.filter(function (x) { return !x.daXuLy; }).length); draw(); });
      };
    });
    $$('.g-del').forEach(function (b) {
      b.onclick = async function () {
        var id = b.closest('[data-id]').dataset.id;
        if (!(await Modal.confirm({ title: 'Xóa góp ý này?', message: 'Không khôi phục được.', confirmText: 'Xóa', danger: true }))) return;
        busy(b, async function () { await Api.call('xuLyGopY', { id: id, xoa: true }); data = data.filter(function (x) { return x.id !== id; }); updateGopYBadge(data.filter(function (x) { return !x.daXuLy; }).length); draw(); }, { ok: 'Đã xóa' });
      };
    });
  };
  try { var r = await Api.call('listGopY'); data = r.gopY; updateGopYBadge(r.moi); draw(); }
  catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không tải được', e.message) + '</div>'); }
}

/* ---------------- CÀI ĐẶT (quản trị) ---------------- */
async function screenSettings() {
  var v = V();
  swap(v, skPage());
  var c, auto;
  try { var res = await Promise.all([Api.call('getCaiDat'), Api.call('trangThaiTuDong')]); c = res[0]; auto = res[1]; }
  catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không tải được', e.message) + '</div>'); return; }
  var pub = location.href.replace(/admin\.html.*$/, 'index.html');
  swap(v, '<div class="page"><div class="page-head"><div class="titles"><h1>Cài đặt</h1><div class="sub">Áp dụng cho toàn hệ thống.</div></div>' +
    '<button class="btn btn-primary" id="sSave">' + icon('check') + '<span>Lưu cài đặt</span></button></div>' +
    '<div class="grid grid-2">' +
    '<div class="panel stack"><h3>Trang tra điểm</h3>' +
    '<div class="field"><label>Tên hiển thị</label><input class="input" id="s_tenHienThi" value="' + esc(c.tenHienThi) + '"></div>' +
    '<div class="field"><label>Lời nhắn dưới tên</label><textarea class="input" id="s_loiNhanTraDiem">' + esc(c.loiNhanTraDiem) + '</textarea></div>' +
    '<label class="switch"><input type="checkbox" id="s_hienThiThuHang" ' + (c.hienThiThuHang ? 'checked' : '') + '><span class="track"></span><span>Hiện thứ hạng trong nhóm</span></label>' +
    '<label class="switch"><input type="checkbox" id="s_hienDiemTB" ' + (c.hienDiemTB ? 'checked' : '') + '><span class="track"></span><span>Hiện điểm trung bình của nhóm</span></label>' +
    '<label class="switch"><input type="checkbox" id="s_choPhepGopY" ' + (c.choPhepGopY ? 'checked' : '') + '><span class="track"></span><span>Cho gửi góp ý từ trang tra điểm</span></label>' +
    '<a class="btn btn-sm" href="' + esc(pub) + '" target="_blank" style="align-self:flex-start">' + icon('link') + '<span>Mở trang tra điểm</span></a></div>' +
    '<div class="stack">' +
    '<div class="panel stack"><h3>Thông báo</h3><div class="field"><label>Email nhận thông báo</label><input class="input" id="s_emailNhanThongBao" type="email" value="' + esc(c.emailNhanThongBao) + '"><div class="hint">Nhận email khi có ảnh phiếu mới và khi có góp ý.</div></div></div>' +
    '<div class="panel stack"><h3>Thống kê</h3><div class="field"><label>Ngưỡng điểm cần bổ túc</label><input class="input" id="s_nguongBoTuc" type="number" min="0" max="10" step="0.5" value="' + esc(c.nguongBoTuc) + '"><div class="hint">Em có điểm dưới mức này hiện trong danh sách cần bổ túc.</div></div></div>' +
    '<div class="panel stack"><h3>Dọn dẹp tự động</h3><div class="field"><label>Giữ ảnh phiếu bao nhiêu ngày sau khi công bố</label><input class="input" id="s_soNgayGiuAnh" type="number" min="1" max="365" value="' + esc(c.soNgayGiuAnh) + '"></div>' +
    '<div class="row"><span id="autoState">' + (auto.daBat ? '<span class="badge ok">Đang bật, chạy mỗi ngày lúc 2 giờ sáng</span>' : '<span class="badge warn">Chưa bật</span>') + '</span>' +
    (auto.daBat ? '' : '<button class="btn btn-sm" id="sAuto">' + icon('clock') + '<span>Bật dọn dẹp tự động</span></button>') + '</div></div>' +
    '</div></div><p class="small muted" style="margin-top:18px">Phiên bản ' + App.version + '</p></div>');
  $('#sSave').onclick = function () {
    var vals = {};
    ['tenHienThi', 'loiNhanTraDiem', 'emailNhanThongBao', 'nguongBoTuc', 'soNgayGiuAnh'].forEach(function (k) { vals[k] = $('#s_' + k).value; });
    ['hienThiThuHang', 'hienDiemTB', 'choPhepGopY'].forEach(function (k) { vals[k] = $('#s_' + k).checked; });
    busy(this, async function () { App.state.caiDat = await Api.call('setCaiDat', { caiDat: vals }); }, { ok: 'Đã lưu cài đặt', done: true });
  };
  if ($('#sAuto')) $('#sAuto').onclick = function () {
    var b = this;
    busy(b, async function () { await Api.call('batTuDong'); $('#autoState').innerHTML = '<span class="badge ok">Đang bật, chạy mỗi ngày lúc 2 giờ sáng</span>'; b.remove(); }, { ok: 'Đã bật dọn dẹp tự động' });
  };
}

/* ---------------- đăng ký các trang ---------------- */
function registerRoutes() {
  Router.on('/', screenHome, { nav: '' });
  Router.on('/lop', screenRoster, { nav: 'lop' });
  Router.on('/lop/:ma', screenRoster, { nav: 'lop' });
  Router.on('/tai-khoan', function () { return isAdmin() ? screenAccounts() : Router.go('/'); }, { nav: 'tai-khoan' });
  Router.on('/gop-y', function () { return isAdmin() ? screenFeedback() : Router.go('/'); }, { nav: 'gop-y' });
  Router.on('/cai-dat', function () { return isAdmin() ? screenSettings() : Router.go('/'); }, { nav: 'cai-dat' });
  if (window.registerBaiRoutes) window.registerBaiRoutes();
  if (window.registerDiemRoutes) window.registerDiemRoutes();
}

document.addEventListener('DOMContentLoaded', boot);
