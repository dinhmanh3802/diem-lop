/* =====================================================================
   VẬT LÝ CÔ LÂM CƯỜNG — trang tra điểm và chuyên cần (học sinh, phụ huynh)
   ===================================================================== */
'use strict';

var PUB = { cfg: null, data: null, pending: null };
var TT = { C: 'Có mặt', M: 'Đi muộn', P: 'Vắng có phép', K: 'Vắng không phép' };

function pubShell() {
  var c = PUB.cfg || {};
  var ten = c.tenHienThi || App.ten;
  document.title = ten + ' | Tra điểm và chuyên cần';
  document.getElementById('root').innerHTML =
    '<div class="pub-bg" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gInk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2346C8"/><stop offset=".55" stop-color="#5B47F0"/><stop offset="1" stop-color="#1AA6C4"/></linearGradient></defs></svg>' +
    '<main class="pub">' +
    '<header class="pub-head"><div class="brand"><i class="mark"></i><span id="pTen">' + esc(ten) + '</span></div>' +
    '<div class="sub-brand">Hệ thống quản lý điểm và chuyên cần</div>' +
    '<p class="muted" id="pLoi">' + esc(c.loiNhan || '') + '</p></header>' +
    '<section class="sheet" aria-labelledby="sbdLabel"><div class="sheet-marks"><i class="mark"></i><i class="mark"></i></div>' +
    '<h1 id="sbdLabel">Số báo danh</h1><p class="muted small">Gõ 6 chữ số ghi trên phiếu trả lời</p>' +
    '<form id="sbdForm" autocomplete="off" novalidate><div class="sbd-boxes" role="group" aria-label="6 chữ số báo danh">' +
    [0, 1, 2, 3, 4, 5].map(function (i) { return '<input class="sbd-box" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Chữ số thứ ' + (i + 1) + '" data-i="' + i + '">'; }).join('') +
    '</div><button class="btn btn-primary btn-lg" id="sbdGo" type="submit">' + icon('search') + '<span>Xem điểm</span></button></form>' +
    '<div id="sbdRecent" class="row" style="justify-content:center;margin-top:12px"></div></section>' +
    '<section id="result" aria-live="polite"></section>' +
    '<footer class="pub-foot">' + (c.choPhepGopY === false ? '' : '<button class="btn btn-ghost btn-sm" id="pFb">' + icon('send') + '<span>Góp ý, báo sai điểm</span></button>') +
    '<a class="btn btn-ghost btn-sm" href="admin.html">' + icon('lock') + '<span>Giáo viên, lớp trưởng đăng nhập</span></a></footer></main>';
  var boxes = $$('.sbd-box');
  var val = function () { return boxes.map(function (b) { return b.value; }).join(''); };
  var paint = function () { boxes.forEach(function (b) { b.classList.toggle('filled', !!b.value); }); };
  var submit = function () { var f = $('#sbdForm'); if (f.requestSubmit) f.requestSubmit(); else $('#sbdGo').click(); };
  var fillFrom = function (s, start, noSubmit) {
    s = String(s).replace(/\D/g, '').slice(0, 6 - (start || 0));
    for (var k = 0; k < s.length; k++) boxes[(start || 0) + k].value = s[k];
    boxes[Math.min(5, (start || 0) + s.length)].focus();
    paint();
    if (/^\d{6}$/.test(val()) && !noSubmit) setTimeout(submit, 0);
  };
  boxes.forEach(function (b, i) {
    b.addEventListener('input', function () {
      var d = b.value.replace(/\D/g, '');
      if (d.length > 1) { b.value = ''; fillFrom(d, i); return; }
      b.value = d; paint();
      if (d && i < 5) boxes[i + 1].focus();
      if (d && i === 5) submit();
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); paint(); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
    });
    b.addEventListener('paste', function (e) { var t = (e.clipboardData || window.clipboardData).getData('text'); if (/\d/.test(t)) { e.preventDefault(); fillFrom(t, 0); } });
    b.addEventListener('focus', function () { b.select(); });
  });
  $('#sbdForm').onsubmit = function (e) {
    e.preventDefault();
    var s = val();
    if (!/^\d{6}$/.test(s)) { var f = $('.sbd-boxes'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); toast('Số báo danh gồm đúng 6 chữ số', 'error'); boxes[Math.min(5, s.length)].focus(); return; }
    lookup(s, $('#sbdGo'));
  };
  if ($('#pFb')) $('#pFb').onclick = function () { pubFeedback(); };
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem('sd_recent') || '[]'); } catch (e) {}
  if (recent.length) $('#sbdRecent').innerHTML = '<span class="small muted">Tra gần đây:</span>' + recent.map(function (r) { return '<button class="chip" data-s="' + esc(r.s) + '" style="padding:5px 12px">' + esc(r.s) + (r.n ? ' <span class="muted small">' + esc(r.n) + '</span>' : '') + '</button>'; }).join('');
  $$('#sbdRecent .chip').forEach(function (c) { c.onclick = function () { fillFrom(c.dataset.s, 0, true); lookup(c.dataset.s, $('#sbdGo')); }; });
  var fromHash = /sbd=(\d{6})/.exec(location.hash || '');
  if (fromHash) { fillFrom(fromHash[1], 0, true); lookup(fromHash[1], $('#sbdGo')); }
  else boxes[0].focus();
}

function remember(sbd, name) {
  try {
    var r = JSON.parse(localStorage.getItem('sd_recent') || '[]').filter(function (x) { return x.s !== sbd; });
    r.unshift({ s: sbd, n: name || '' });
    localStorage.setItem('sd_recent', JSON.stringify(r.slice(0, 3)));
  } catch (e) {}
}

function ringSvg(score, max) {
  var pct = Math.max(0, Math.min(1, (Number(score) || 0) / (max || 10)));
  var r = 44, c = 2 * Math.PI * r;
  return '<svg class="ring-score" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" class="rs-bg"/><circle cx="50" cy="50" r="' + r + '" class="rs-fg" style="--len:' + c + ';--off:' + (c * (1 - pct)) + '"/></svg>';
}

function renderResult(d, sbd) {
  var res = $('#result');
  if (!d.found) {
    res.innerHTML = '<div class="pub-card view-enter">' + emptyState('search', 'Không tìm thấy số báo danh ' + sbd, 'Kiểm tra lại 6 chữ số trên phiếu. Nếu chắc chắn đúng, hãy hỏi cô.') + '</div>';
    return;
  }
  var name = ((d.ho || '') + ' ' + (d.ten || '')).trim();
  var html = '<div class="pub-card view-enter"><div class="who-big"><div class="avatar" style="width:48px;height:48px;font-size:18px;background:var(--ink-grad)">' + esc(initials(name || sbd)) + '</div><div class="grow"><h2>' + esc(name || 'SBD ' + sbd) + '</h2>' +
    kv([['Số báo danh', sbd], ['Nhóm', d.tenNhom || ''], d.daChuyen ? ['Trạng thái', 'Đã chuyển nhóm', 'warn'] : null]) + '</div></div></div>';
  if (d.chuyenCan) html += ccCard(d.chuyenCan);
  if (!d.bai.length) html += '<div class="pub-card view-enter">' + emptyState('clock', 'Chưa có bài nào được công bố', 'Khi cô công bố điểm, kết quả sẽ hiện ở đây.') + '</div>';
  else html += '<div class="stagger">' + d.bai.map(function (b, i) {
    var parts = ['I', 'II', 'III'].map(function (p, k) {
      var mx = b.mx[k], v = [b.p1, b.p2, b.p3][k];
      if (!mx) return '';
      return '<div class="part"><div class="row small"><span class="part-l">Phần ' + p + ':</span><b class="num">' + fmtScore(v) + '</b><span class="muted">/ ' + fmtScore(mx) + '</span></div><div class="hbar"><i style="width:' + Math.round(100 * v / mx) + '%;animation-delay:' + (300 + i * 80) + 'ms"></i></div></div>';
    }).join('');
    var tiles = kv([
      b.hang ? ['Hạng trong lớp', b.hang + '/' + b.soHs] : null,
      b.tbNhom !== null && b.tbNhom !== undefined ? ['Điểm TB lớp', fmtScore(b.tbNhom)] : null,
      b.caoNhat !== null && b.caoNhat !== undefined ? ['Điểm cao nhất lớp', fmtScore(b.caoNhat), 'good'] : null,
      ['Mã đề', b.maDe], ['Ngày kiểm tra', fmtDate(b.ngay)]
    ], 'tiles');
    return '<article class="pub-card score-card' + (b.tong >= 8 ? ' top' : '') + '" data-ma="' + esc(b.maBai) + '">' +
      '<div class="score"><div class="score-ring">' + ringSvg(b.tong, 10) + '<div class="score-num"><b class="num" data-to="' + b.tong + '">0</b><span>điểm</span></div></div>' +
      '<div class="grow"><h3>' + esc(b.tenBai) + '</h3>' + (b.sbdCu ? '<div class="small muted" style="margin-top:4px">Làm bài theo SBD cũ ' + esc(b.sbdCu) + '</div>' : '') + '</div></div>' +
      tiles + '<div class="parts">' + parts + '</div>' +
      '<button class="btn btn-sm see" data-ma="' + esc(b.maBai) + '">' + icon('eye') + '<span>Xem từng câu</span></button></article>';
  }).join('') + '</div>';
  res.innerHTML = html;
  $$('.score-num b[data-to]', res).forEach(function (el, i) { setTimeout(function () { countUp(el, Number(el.dataset.to), 1100); }, 120 + i * 90); });
  requestAnimationFrame(function () { $$('.rs-fg', res).forEach(function (c) { c.classList.add('go'); }); });
  $$('.see', res).forEach(function (b) { b.onclick = function () { detail(sbd, b.dataset.ma, b); }; });
  if (d.chuyenCan && $('#ccBao')) $('#ccBao').onclick = function () { baoSaiDiemDanh(sbd, d.chuyenCan); };
  var top = res.querySelector('.score-card.top');
  if (top && !PUB.celebrated) { PUB.celebrated = true; setTimeout(function () { celebrateAt(top.querySelector('.score-ring')); }, 1150); }
}

function ccCard(cc) {
  var nguong = 80;
  return '<div class="pub-card view-enter"><div class="row"><h3 class="grow">Chuyên cần</h3>' +
    (cc.tiLe !== null ? '<span class="badge ' + (cc.tiLe >= nguong ? 'ok' : 'red') + '">' + (cc.tiLe >= nguong ? 'Đi học đều' : 'Cần chú ý') + '</span>' : '') + '</div>' +
    (cc.soBuoi ? kv([['Số buổi đã học', cc.soBuoi], ['Có mặt', cc.dem.C, 'good'], ['Đi muộn', cc.dem.M, cc.dem.M ? 'warn' : ''], ['Vắng có phép', cc.dem.P, cc.dem.P ? 'blue' : ''],
      ['Vắng không phép', cc.dem.K, cc.dem.K ? 'bad' : ''], ['Tỉ lệ đi học', fmtScore(cc.tiLe) + '%', cc.tiLe >= nguong ? 'good' : 'bad']], 'tiles') +
      '<div class="small muted" style="margin-top:12px">Các buổi gần đây (mới nhất bên trái):</div><div class="cc-dots">' + cc.gan.map(function (g) {
        return '<span class="dot ' + g.tt + '" title="' + esc(fmtDate(g.ngay) + ': ' + TT[g.tt]) + '">' + fmtDate(g.ngay).slice(0, 2) + '</span>';
      }).join('') + '</div>' +
      '<div class="cc-legend"><span><i style="background:var(--green)"></i>Có mặt</span><span><i style="background:var(--amber)"></i>Đi muộn</span><span><i style="background:#3B7BE0"></i>Vắng có phép</span><span><i style="background:var(--red)"></i>Vắng không phép</span></div>' +
      '<button class="btn btn-sm btn-ghost" id="ccBao" style="margin-top:10px">' + icon('alert') + '<span>Báo sai điểm danh</span></button>'
      : '<p class="muted small" style="margin-top:8px">Chưa có buổi học nào được điểm danh.</p>') + '</div>';
}

async function lookup(sbd, btn) {
  if (btn && btn.classList.contains('is-loading')) { PUB.pending = sbd; return; }
  var res = $('#result'), cached = null;
  try { cached = JSON.parse(localStorage.getItem('sd_res_' + sbd) || 'null'); } catch (e) {}
  if (cached) renderResult(cached, sbd);                              // hiện ngay bản đã tra lần trước, cập nhật ngầm
  else res.innerHTML = '<div class="pub-card"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-block" style="margin-top:14px"></div></div>';
  try { history.replaceState(null, '', '#sbd=' + sbd); } catch (e) {}
  PUB.celebrated = !!cached;
  await busy(btn, async function () {
    var d = await Api.call('traDiem', { sbd: sbd }, { noAuth: true });
    PUB.data = d;
    if (!cached || JSON.stringify(cached) !== JSON.stringify(d)) renderResult(d, sbd);
    if (d.found) { remember(sbd, d.ten); try { localStorage.setItem('sd_res_' + sbd, JSON.stringify(d)); } catch (e) {} }
    if (!cached) setTimeout(function () { var first = res.querySelector('.who-big'); if (first && first.scrollIntoView) first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }, 80);
  }, { silent: true, rethrow: true }).catch(function (e) {
    if (cached) { toast('Đang hiện kết quả đã lưu trên máy. ' + e.message, 'warn'); return; }
    res.innerHTML = '<div class="pub-card view-enter">' + emptyState('alert', 'Chưa tra được', e.message, '<button class="btn btn-primary" id="pRetry">' + icon('refresh') + '<span>Thử lại</span></button>') + '</div>';
    $('#pRetry').onclick = function () { lookup(sbd, this); };
  });
  if (PUB.pending) { var nx = PUB.pending; PUB.pending = null; if (nx !== sbd) lookup(nx, btn); }
}

async function detail(sbd, maBai, btn) {
  await busy(btn, async function () {
    var d = await Api.call('chiTietBai', { sbd: sbd, maBai: maBai }, { noAuth: true });
    var h = '<div class="row" style="margin-bottom:14px"><div class="score-ring sm">' + ringSvg(d.tong, 10) + '<div class="score-num"><b class="num">' + fmtScore(d.tong) + '</b></div></div>' +
      '<div class="grow">' + kv([['Mã đề', d.maDe], ['Ngày kiểm tra', fmtDate(d.ngay)], ['Phần I', fmtScore(d.p1) + '/' + fmtScore(d.mx[0])], ['Phần II', fmtScore(d.p2) + '/' + fmtScore(d.mx[1])], ['Phần III', fmtScore(d.p3) + '/' + fmtScore(d.mx[2])]]) +
      (d.daSua ? '<div class="small muted" style="margin-top:6px">Điểm đã được cô điều chỉnh.</div>' : '') + '</div></div>' +
      '<div class="legend small"><span><span class="bubble on key" style="width:18px;height:18px"></span> em chọn đúng</span><span><span class="bubble on wrong" style="width:18px;height:18px"></span> em chọn sai</span><span><span class="bubble key" style="width:18px;height:18px"></span> đáp án đúng</span></div>';
    if (!d.key || !d.tl) h += '<div class="note">' + icon('info') + '<div>Bài này chưa có chi tiết từng câu.</div></div>';
    else {
      var cnt = function (arr, v) { return (arr || []).filter(function (x) { return x === v; }).length; };
      if (d.cfg.p1) h += '<h3 class="dh">Phần I <span class="muted small">Đúng: <b>' + cnt(d.dung.p1, 1) + '/' + d.cfg.p1.soCau + '</b></span></h3><div class="ans-grid">' +
        Array.from({ length: d.cfg.p1.soCau }, function (_, i) {
          var a = (d.tl.p1 || [])[i] || '', k = (d.key.p1 || [])[i];
          return '<div class="q ' + (a === k ? '' : 'wrongq') + '"><span class="n">' + (i + 1) + '</span>' + ['A', 'B', 'C', 'D'].map(function (o) { return '<span class="bubble ' + (a === o ? 'on' : '') + (k === o ? ' key' : '') + (a === o && k !== o ? ' wrong' : '') + '">' + o + '</span>'; }).join('') + (a ? '' : '<span class="small muted">bỏ trống</span>') + '</div>';
        }).join('') + '</div>';
      if (d.cfg.p2) h += '<h3 class="dh">Phần II</h3><div class="stack" style="gap:4px">' + Array.from({ length: d.cfg.p2.soCau }, function (_, i) {
        var s = ((d.tl.p2 || [])[i] || '____'), k = (d.key.p2 || [])[i] || '', n = d.dung.p2[i];
        return '<div class="q2"><b class="small">Câu ' + (i + 1) + '<br><span class="muted" style="font-weight:500">Đúng: ' + n + '/4 ý</span></b>' + [0, 1, 2, 3].map(function (y) {
          return '<span class="y"><b>' + 'abcd'[y] + '</b>' + ['Đ', 'S'].map(function (o) { return '<span class="bubble ' + (s[y] === o ? 'on' : '') + (k[y] === o ? ' key' : '') + (s[y] === o && k[y] !== o ? ' wrong' : '') + '">' + o + '</span>'; }).join('') + '</span>';
        }).join('') + '</div>';
      }).join('') + '</div>';
      if (d.cfg.p3) h += '<h3 class="dh">Phần III <span class="muted small">Đúng: <b>' + cnt(d.dung.p3, 1) + '/' + d.cfg.p3.soCau + '</b></span></h3><div class="p3-list">' + Array.from({ length: d.cfg.p3.soCau }, function (_, i) {
        var a = (d.tl.p3 || [])[i] || '', k = (d.key.p3 || [])[i] || '', ok = d.dung.p3[i] === 1;
        return '<div class="p3 ' + (ok ? 'ok' : 'bad') + '"><span class="n">Câu ' + (i + 1) + '</span><span class="v">' + (a ? esc(a) : '<i class="muted">bỏ trống</i>') + '</span>' + (ok ? icon('check') : '<span class="k">Đáp án: ' + esc(k) + '</span>') + '</div>';
      }).join('') + '</div><p class="small muted" style="margin-top:8px">Phần III chấm theo đúng các ký tự đã tô, ví dụ 8,50 khác 8,5.</p>';
    }
    Modal.open({ title: d.tenBai, size: 'lg', body: h, actions: [{ label: 'Đóng', kind: 'btn-primary' }] });
    requestAnimationFrame(function () { $$('.modal .rs-fg').forEach(function (c) { c.classList.add('go'); }); });
  });
}

function baoSaiDiemDanh(sbd, cc) {
  Modal.open({
    title: 'Báo sai điểm danh',
    body: '<div class="stack"><p class="small muted">Cô sẽ xem và sửa nếu đúng. Ghi rõ lý do giúp cô xử lý nhanh hơn.</p>' +
      '<div class="field"><label>Buổi học</label><select class="input" id="bsB">' + cc.gan.map(function (g) { return '<option value="' + esc(g.maBuoi) + '">' + esc(fmtDate(g.ngay)) + ' (đang ghi: ' + TT[g.tt] + ')</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Trạng thái đúng</label><select class="input" id="bsT">' + Object.keys(TT).map(function (k) { return '<option value="' + k + '">' + TT[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Lý do</label><textarea class="input" id="bsL" placeholder="vd: Hôm đó con có đi học, đến muộn 10 phút"></textarea></div>' +
      '<div class="field"><label>Liên hệ (không bắt buộc)</label><input class="input" id="bsC" placeholder="số điện thoại phụ huynh"></div>' +
      '<input id="bsW" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Gửi cho cô', kind: 'btn-primary', icon: 'send', onClick: async function (c) {
      await Api.call('ddBaoSai', { sbd: sbd, maBuoi: c.$('#bsB').value, moi: c.$('#bsT').value, lyDo: c.$('#bsL').value, lienHe: c.$('#bsC').value, website: c.$('#bsW').value }, { noAuth: true });
      c.close(); toast('Đã gửi cho cô. Cảm ơn bạn!', 'success');
    } }]
  });
}

function pubFeedback() {
  var sbd = PUB.data && PUB.data.found ? PUB.data.sbd : '';
  Modal.open({
    title: 'Góp ý, báo sai điểm',
    body: '<div class="stack"><div class="field"><label>Nội dung</label><textarea class="input" id="gN" placeholder="vd: Bài kiểm tra ngày 28/8 em được 8 điểm nhưng web hiện 7,5"></textarea></div>' +
      '<div class="grid grid-2"><div class="field"><label>Số báo danh (nếu có)</label><input class="input" id="gS" inputmode="numeric" maxlength="6" value="' + esc(sbd) + '"></div>' +
      '<div class="field"><label>Liên hệ (không bắt buộc)</label><input class="input" id="gL" placeholder="số điện thoại hoặc email"></div></div>' +
      '<input id="gW" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Gửi', kind: 'btn-primary', icon: 'send', onClick: async function (c) {
      await Api.call('guiGopY', { noiDung: c.$('#gN').value, sbd: c.$('#gS').value, lienHe: c.$('#gL').value, website: c.$('#gW').value }, { noAuth: true });
      c.close(); toast('Đã gửi. Cảm ơn bạn!', 'success');
    } }]
  });
}

async function pubBoot() {
  offlineBanner();
  try { PUB.cfg = JSON.parse(localStorage.getItem('sd_pubcfg') || 'null'); } catch (e) {}
  if (!(window.APP_CONFIG && /^https?:\/\//.test(window.APP_CONFIG.API_URL || ''))) {
    document.getElementById('root').innerHTML = '<main class="pub"><div class="pub-card">' + emptyState('alert', 'Trang chưa được cấu hình', 'Quản trị cần điền địa chỉ máy chủ vào file config.js.') + '</div></main>';
    return;
  }
  pubShell();
  try {
    var c = await Api.call('publicConfig', {}, { noAuth: true, silent: true });
    PUB.cfg = c;
    try { localStorage.setItem('sd_pubcfg', JSON.stringify(c)); } catch (e) {}
    $('#pTen').textContent = c.tenHienThi || App.ten; $('#pLoi').textContent = c.loiNhan || ''; document.title = (c.tenHienThi || App.ten) + ' | Tra điểm và chuyên cần';
    if (c.choPhepGopY === false && $('#pFb')) $('#pFb').remove();
  } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:') { try { navigator.serviceWorker.register('sw.js'); } catch (e) {} }
}

document.addEventListener('DOMContentLoaded', pubBoot);
