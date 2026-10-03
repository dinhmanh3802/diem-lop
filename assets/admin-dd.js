/* =====================================================================
   VẬT LÝ CÔ LÂM CƯỜNG — điểm danh, chuyên cần
   ===================================================================== */
'use strict';

var DDT = { C: 'Có mặt', M: 'Đi muộn', P: 'Vắng có phép', K: 'Vắng không phép' };
var DDS = { C: 'Có mặt', M: 'Muộn', P: 'Vắng P', K: 'Vắng K' };
function isLT() { return App.state.user && App.state.user.role === 'loptruong'; }
function ddBadge(tt) { return tt === 'Đã chốt' ? '<span class="badge ok">Đã chốt</span>' : tt === 'Đã nộp' ? '<span class="badge blue">Đã gửi cho cô</span>' : '<span class="badge warn">Đang điểm danh</span>'; }

/* ---------------- trang chính điểm danh ---------------- */
async function screenDdHome() {
  var v = V();
  swap(v, skPage());
  var d;
  try { d = await Api.call('ddTongQuan'); } catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không tải được', e.message) + '</div>'); return; }
  if (d.laLopTruong) {
    var hn = d.ganDay.filter(function (b) { return b.ngay === d.homNay; })[0];
    swap(v, '<div class="page"><div class="hero"><h1>Điểm danh ' + esc(d.tenNhom) + '</h1><div class="sub">Hôm nay ' + fmtDate(d.homNay) + '. Bạn là lớp trưởng: chỉ điểm danh được buổi của hôm nay, cô sẽ kiểm tra lại.</div>' +
      '<div class="row" style="margin-top:16px"><a class="btn btn-primary btn-lg" href="#/diem-danh/mo/' + esc(d.maNhom) + '">' + icon('check') + '<span>' + (hn ? 'Tiếp tục điểm danh hôm nay' : 'Bắt đầu điểm danh hôm nay') + '</span></a></div></div>' +
      '<div class="panel"><div class="panel-head"><h3>Các buổi gần đây</h3></div>' + (d.ganDay.length ? '<div class="list">' + d.ganDay.map(function (b) {
        return '<a class="item" href="#/diem-danh/buoi/' + esc(b.maBuoi) + '"><div class="grow"><div class="t">' + fmtDate(b.ngay) + (b.ngay === d.homNay ? ' (hôm nay)' : '') + '</div>' +
          '<div class="s">' + kv([['Có mặt', b.dem.C + b.dem.M], ['Vắng', b.dem.P + b.dem.K, b.dem.K ? 'bad' : '']]) + '</div></div>' + ddBadge(b.trangThai) + icon('chevR', 'chev') + '</a>';
      }).join('') + '</div>' : emptyState('clock', 'Chưa có buổi nào', 'Bấm "Bắt đầu điểm danh hôm nay".')) + '</div></div>');
    return;
  }
  swap(v, '<div class="page"><div class="page-head"><div class="titles"><h1>Điểm danh, chuyên cần</h1><div class="sub">Hôm nay ' + fmtDate(d.homNay) + '. Cô điểm danh hoặc để lớp trưởng điểm danh, cô kiểm tra và chốt.</div></div></div>' +
    (d.choDuyet ? '<div class="note warn" style="margin-bottom:14px">' + icon('alert') + '<div class="grow">Có <b>' + d.choDuyet + '</b> yêu cầu sửa điểm danh đang chờ cô duyệt.</div></div>' : '') +
    (d.nhom.length ? '<div class="grid grid-2 stagger">' + d.nhom.map(function (g) {
      var h = g.homNay;
      return '<div class="panel stack"><div class="row"><h3 class="grow">' + esc(g.tenNhom) + '</h3>' + (h ? ddBadge(h.trangThai) : '<span class="badge">Chưa điểm danh</span>') + '</div>' +
        kv([['Sĩ số', g.siSo], ['Số buổi đã ghi', g.soBuoi], h ? ['Hôm nay có mặt', (h.dem.C + h.dem.M) + '/' + (h.dem.C + h.dem.M + h.dem.P + h.dem.K), 'good'] : null,
          h && h.nopBoi ? ['Người gửi', h.nopBoi] : null, g.choDuyet ? ['Yêu cầu chờ duyệt', g.choDuyet, 'warn'] : null]) +
        '<div class="row"><a class="btn ' + (h ? '' : 'btn-primary') + '" href="#/diem-danh/mo/' + esc(g.maNhom) + '">' + icon('check') + '<span>' + (h ? 'Mở buổi hôm nay' : 'Điểm danh hôm nay') + '</span></a>' +
        '<a class="btn btn-ghost" href="#/diem-danh/nhom/' + esc(g.maNhom) + '">' + icon('chart') + '<span>Phân tích</span></a></div></div>';
    }).join('') + '</div>' : emptyState('users', 'Chưa có nhóm', 'Vào "Lớp và học sinh" để đồng bộ nhóm trước.')) + '</div>');
}

/* mở (hoặc tạo) buổi hôm nay rồi chuyển sang màn điểm danh */
async function screenDdMo(params) {
  swap(V(), skPage());
  try {
    var r = await Api.call('ddMoBuoi', { maNhom: params.ma, ngay: params.ngay || '' });
    EX.dd = r;
    history.replaceState(null, '', '#/diem-danh/buoi/' + encodeURIComponent(r.buoi.maBuoi));
    Router.cur = '/diem-danh/buoi/' + r.buoi.maBuoi;
    drawDdBuoi(r);
  } catch (e) { swap(V(), '<div class="page"><a class="back" href="#/diem-danh">' + icon('chevL') + 'Điểm danh</a>' + emptyState('alert', 'Không mở được buổi học', e.message) + '</div>'); }
}
async function screenDdBuoi(params) {
  if (EX.dd && EX.dd.buoi.maBuoi === params.id) { drawDdBuoi(EX.dd); }
  else swap(V(), skPage());
  try { var r = await Api.call('ddXemBuoi', { maBuoi: params.id }); EX.dd = r; drawDdBuoi(r); }
  catch (e) { swap(V(), '<div class="page"><a class="back" href="#/diem-danh">' + icon('chevL') + 'Điểm danh</a>' + emptyState('alert', 'Không mở được buổi học', e.message) + '</div>'); }
}

/* ---------------- màn điểm danh (cô và lớp trưởng) ---------------- */
function drawDdBuoi(r) {
  var b = r.buoi, id = b.maBuoi, QK = 'sd_ddq_' + id;
  var dd = Object.assign({}, r.dd), q = {};
  try { q = JSON.parse(localStorage.getItem(QK) || '{}') || {}; } catch (e) {}
  Object.keys(q).forEach(function (s) { dd[s] = q[s]; });                      // thay đổi chưa gửi được lần trước
  var st = { q: '', lyDo: '', syncing: false, err: '' };
  var sua = r.suaDuoc, khoaGV = !r.laLopTruong && (b.trangThai === 'Đã chốt' || !b.homNay);
  var list = r.students;
  var counts = function () { var c = { C: 0, M: 0, P: 0, K: 0 }; list.forEach(function (s) { c[dd[s.sbd] || 'C']++; }); return c; };
  var persist = function () { try { if (Object.keys(q).length) localStorage.setItem(QK, JSON.stringify(q)); else localStorage.removeItem(QK); } catch (e) {} };
  var paintCounts = function () { var c = counts(); ['C', 'M', 'P', 'K'].forEach(function (k) { var el = $('#ddc_' + k); if (el) el.textContent = c[k]; }); };
  var paintState = function () {
    var el = $('#ddSave'); if (!el) return;
    var n = Object.keys(q).length;
    if (st.syncing) el.className = 'save-state', el.innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px"></span>Đang gửi…';
    else if (st.err) el.className = 'save-state bad', el.innerHTML = icon('alert') + 'Chưa gửi được ' + n + ' thay đổi, sẽ tự thử lại';
    else if (n) el.className = 'save-state', el.innerHTML = icon('clock') + n + ' thay đổi chờ gửi';
    else el.className = 'save-state ok', el.innerHTML = icon('check') + 'Đã lưu';
  };
  var sync = async function () {
    if (st.syncing || !Object.keys(q).length) return;
    st.syncing = true; st.err = ''; paintState();
    var batch = Object.assign({}, q);
    try {
      await Api.call('ddLuu', { maBuoi: id, ghi: Object.keys(batch).map(function (s) { return { sbd: s, tt: batch[s] }; }), lyDo: st.lyDo }, { silent: true, retry: 2 });
      Object.keys(batch).forEach(function (s) { if (q[s] === batch[s]) delete q[s]; });
      persist();
    } catch (e) {
      st.err = e.message;
      if (e.code !== 'NETWORK' && e.code !== 'TIMEOUT') { q = {}; persist(); toastErr(e); st.syncing = false; return screenDdBuoi({ id: id }); }
      setTimeout(sync, 6000);
    }
    st.syncing = false; paintState();
    if (Object.keys(q).length && !st.err) later();
  };
  var later = debounce(sync, 900);
  window.addEventListener('online', sync);
  Router.guard = async function () {
    if (!Object.keys(q).length) return true;
    await sync();
    if (!Object.keys(q).length) return true;
    return Modal.confirm({ title: 'Còn thay đổi chưa gửi được', message: 'Các thay đổi vẫn được giữ trên máy này và sẽ gửi khi mở lại buổi này. Vẫn rời đi?', confirmText: 'Rời đi' });
  };
  var askReason = async function () {
    if (!khoaGV || st.lyDo) return true;
    return new Promise(function (resolve) {
      Modal.open({ title: 'Sửa buổi đã khóa', body: '<p class="small muted" style="margin-bottom:10px">Buổi ' + fmtDate(b.ngay) + ' đã ' + (b.trangThai === 'Đã chốt' ? 'chốt' : 'qua ngày') + '. Ghi lý do một lần cho các thay đổi lần này (lưu vào nhật ký).</p><input class="input" id="ddWhy" placeholder="vd: ghi bù, em có xin phép">',
        onClose: function (v) { resolve(!!v); },
        actions: [{ label: 'Hủy', kind: 'btn-ghost', value: false }, { label: 'Tiếp tục sửa', kind: 'btn-primary', onClick: function (c) { var w = c.$('#ddWhy').value.trim(); if (w.length < 3) { toast('Ghi lý do', 'error'); return; } st.lyDo = w; c.close(true); } }] });
    });
  };
  var setTT = function (sbd, tt) {
    if (khoaGV && !st.lyDo) { askReason().then(function (ok) { if (ok) setTT(sbd, tt); }); return; }   // chỉ chờ khi phải hỏi lý do
    dd[sbd] = tt; q[sbd] = tt; persist();
    var row = $('.dd-row[data-sbd="' + sbd + '"]');
    if (row) { row.className = 'dd-row st-' + tt; $$('.dd-seg button', row).forEach(function (x) { x.classList.toggle('on', x.dataset.t === tt); }); }
    paintCounts(); paintState(); later();
  };
  var rowsHtml = function () {
    var qq = st.q.toLowerCase();
    return list.filter(function (s) { return !qq || (s.sbd + ' ' + s.ho + ' ' + s.ten).toLowerCase().indexOf(qq) !== -1; }).map(function (s) {
      var tt = dd[s.sbd] || 'C', note = r.ghiChu[s.sbd];
      return '<div class="dd-row st-' + tt + '" data-sbd="' + esc(s.sbd) + '"><div class="who"><b>' + esc(((s.ho || '') + ' ' + (s.ten || '')).trim()) + '</b><span class="sbd">' + esc(s.sbd) + '</span>' + (note ? '<span> · ' + esc(note) + '</span>' : '') + '</div>' +
        '<div class="dd-seg" role="group" aria-label="Trạng thái" ' + (sua ? '' : 'aria-disabled="true"') + '>' + ['C', 'M', 'P', 'K'].map(function (k) {
          return '<button data-t="' + k + '" class="' + (tt === k ? 'on' : '') + '" title="' + DDT[k] + '" aria-label="' + DDT[k] + '">' + (k === 'C' ? '✓' : k) + '</button>';
        }).join('') + '</div>' + (!sua && r.laLopTruong ? '<button class="btn btn-sm btn-ghost dd-req" title="Yêu cầu sửa">' + icon('pen') + '</button>' : '') + '</div>';
    }).join('') || emptyState('search', 'Không có em nào khớp', '');
  };
  swap(V(), '<div class="page"><a class="back" href="#/diem-danh">' + icon('chevL') + 'Điểm danh</a>' +
    '<div class="page-head"><div class="titles"><h1>' + esc(r.tenNhom) + ' ' + ddBadge(b.trangThai) + '</h1>' +
    kv([['Ngày', fmtDate(b.ngay) + (b.homNay ? ' (hôm nay)' : '')], ['Sĩ số', list.length], b.nopBoi ? ['Người gửi', b.nopBoi + ' lúc ' + b.nopLuc] : null, b.chotBoi ? ['Cô chốt lúc', b.chotLuc] : null]) + '</div>' +
    (r.laLopTruong ? '' : '<div class="menu"><button class="btn" id="ddMore">' + icon('more') + '<span>Thêm</span></button></div>') + '</div>' +
    (!sua ? '<div class="note blue" style="margin-bottom:10px">' + icon('lock') + '<div>' + esc(r.lyDoKhoa) + (r.laLopTruong ? ' Bấm biểu tượng bút ở dòng cần sửa để gửi yêu cầu.' : '') + '</div></div>' : '') +
    '<div class="dd-top"><div class="dd-count">' + ['C', 'M', 'P', 'K'].map(function (k) { return '<div class="' + k + '" title="' + DDT[k] + '"><b id="ddc_' + k + '">0</b><span>' + DDS[k] + '</span></div>'; }).join('') + '</div>' +
    '<div class="row" style="margin-top:10px"><input class="input input-sm grow" id="ddQ" type="search" placeholder="Tìm tên hoặc SBD" style="min-width:150px">' +
    (sua ? '<button class="btn btn-sm" id="ddAll">' + icon('check') + '<span>Tất cả có mặt</span></button>' : '') + '<span id="ddSave" class="save-state"></span></div></div>' +
    '<p class="small muted" style="margin-top:6px">✓ có mặt, <b>M</b> đi muộn, <b>P</b> vắng có phép, <b>K</b> vắng không phép. Mặc định cả lớp có mặt: chỉ cần chạm vào em vắng hoặc muộn.</p>' +
    '<div class="dd-list" id="ddList">' + rowsHtml() + '</div>' +
    (sua ? '<div class="panel row" style="margin-top:14px;position:sticky;bottom:calc(76px + env(safe-area-inset-bottom));box-shadow:var(--shadow-pop)"><span class="grow small muted">Thay đổi được lưu ngay khi chạm.</span>' +
      (r.laLopTruong || b.trangThai === 'Đang mở' ? '<button class="btn btn-primary btn-lg" id="ddNop">' + icon('send') + '<span>' + (r.laLopTruong ? 'Gửi cho cô' : 'Hoàn tất') + '</span></button>' : '') +
      (!r.laLopTruong ? '<button class="btn btn-lg" id="ddChot">' + icon('lock') + '<span>' + (b.trangThai === 'Đã chốt' ? 'Mở lại' : 'Chốt buổi') + '</span></button>' : '') + '</div>'
      : (!r.laLopTruong ? '<div class="row" style="margin-top:14px"><button class="btn" id="ddChot">' + icon('lock') + '<span>' + (b.trangThai === 'Đã chốt' ? 'Mở lại buổi' : 'Chốt buổi') + '</span></button></div>' : '')) + '</div>');
  var bindRows = function () {
    $$('#ddList .dd-row').forEach(function (row) {
      var sbd = row.dataset.sbd;
      $$('.dd-seg button', row).forEach(function (bt) { bt.onclick = function () { setTT(sbd, bt.dataset.t); }; });
      var rq = row.querySelector('.dd-req');
      if (rq) rq.onclick = function () { ddYeuCauModal(id, sbd, dd[sbd] || 'C', row.querySelector('b').textContent); };
    });
  };
  bindRows(); paintCounts(); paintState();
  if (Object.keys(q).length) sync();
  $('#ddQ').oninput = debounce(function () { st.q = $('#ddQ').value; $('#ddList').innerHTML = rowsHtml(); bindRows(); }, 150);
  if ($('#ddAll')) $('#ddAll').onclick = async function () {
    var vang = list.filter(function (s) { return (dd[s.sbd] || 'C') !== 'C'; });
    if (vang.length && !(await Modal.confirm({ title: 'Đặt tất cả là có mặt?', message: 'Đang có ' + vang.length + ' em được ghi muộn/vắng. Đặt lại tất cả là có mặt?', confirmText: 'Đặt lại' }))) return;
    if (!(await askReason())) return;
    list.forEach(function (s) { if ((dd[s.sbd] || 'C') !== 'C') { dd[s.sbd] = 'C'; q[s.sbd] = 'C'; } });
    persist(); $('#ddList').innerHTML = rowsHtml(); bindRows(); paintCounts(); paintState(); later();
  };
  if ($('#ddNop')) $('#ddNop').onclick = function () {
    var btn = this;
    busy(btn, async function () {
      await sync();
      if (Object.keys(q).length) throw ApiError('ERR', 'Còn thay đổi chưa gửi được, kiểm tra mạng rồi thử lại');
      await Api.call('ddNop', { maBuoi: id });
      celebrateAt(btn);
      toast(r.laLopTruong ? 'Đã gửi điểm danh cho cô' : 'Đã hoàn tất điểm danh', 'success');
      setTimeout(function () { Router.go('/diem-danh'); }, 900);
    });
  };
  if ($('#ddChot')) $('#ddChot').onclick = function () {
    var chot = b.trangThai !== 'Đã chốt';
    busy(this, async function () { await sync(); await Api.call('ddChot', { maBuoi: id, chot: chot }); EX.dd = null; await screenDdBuoi({ id: id }); }, { ok: chot ? 'Đã chốt buổi: lớp trưởng không sửa được nữa' : 'Đã mở lại buổi' });
  };
  if ($('#ddMore')) $('#ddMore').onclick = function (e) {
    e.stopPropagation();
    popMenu(this, [
      { label: 'Nhật ký thay đổi', icon: 'clock', onClick: function () { ddLogModal(r); } },
      { label: 'Phân tích nhóm', icon: 'chart', onClick: function () { Router.go('/diem-danh/nhom/' + b.maNhom); } },
      '-',
      { label: 'Xóa buổi này', icon: 'trash', danger: true, onClick: async function () {
        var ok = await Modal.confirm({ title: 'Xóa buổi ' + fmtDate(b.ngay) + '?', danger: true, confirmText: 'Xóa buổi', typeToConfirm: 'XOA', html: 'Dùng khi tạo nhầm buổi (vd hôm đó nghỉ học). Dữ liệu điểm danh buổi này bị xóa; nhật ký vẫn giữ.' });
        if (!ok) return;
        busy(null, async function () { await Api.call('ddXoaBuoi', { maBuoi: id, lyDo: 'xóa buổi tạo nhầm' }); Router.go('/diem-danh/nhom/' + b.maNhom); }, { ok: 'Đã xóa buổi' });
      } }
    ]);
  };
}

function ddLogModal(r) {
  var log = r.nhatKy || [];
  Modal.open({ title: 'Nhật ký buổi ' + fmtDate(r.buoi.ngay), size: 'lg', body: log.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Người</th><th>SBD</th><th>Thay đổi</th><th>Loại</th></tr></thead><tbody>' +
    log.map(function (l) { return '<tr><td class="small muted" style="white-space:nowrap">' + esc(l.luc) + '</td><td>' + esc(l.nguoi) + '</td><td class="sbd">' + esc(l.sbd) + '</td><td class="small">' + esc(DDT[l.cu] || l.cu) + ' → <b>' + esc(DDT[l.moi] || l.moi) + '</b>' + (l.lyDo ? '<div class="muted">' + esc(l.lyDo) + '</div>' : '') + '</td><td>' + (/sau/.test(l.loai) ? '<span class="badge warn plain">' + esc(l.loai) + '</span>' : esc(l.loai)) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' : emptyState('clock', 'Chưa có thay đổi', 'Mọi thay đổi trạng thái đều được ghi lại ở đây.'), actions: [{ label: 'Đóng', kind: 'btn-primary' }] });
}

function ddYeuCauModal(maBuoi, sbd, cu, ten) {
  Modal.open({ title: 'Yêu cầu sửa: ' + ten, body: '<div class="stack">' + kv([['Đang ghi', DDT[cu]]]) +
    '<div class="field"><label>Sửa thành</label><select class="input" id="ycT">' + Object.keys(DDT).filter(function (k) { return k !== cu; }).map(function (k) { return '<option value="' + k + '">' + DDT[k] + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Lý do</label><textarea class="input" id="ycL" placeholder="vd: Bạn đến muộn 10 phút nên em ghi nhầm là vắng"></textarea></div><p class="small muted">Cô sẽ duyệt. Yêu cầu và người gửi được lưu lại.</p></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Gửi yêu cầu', kind: 'btn-primary', icon: 'send', onClick: async function (c) {
      await Api.call('ddYeuCau', { maBuoi: maBuoi, sbd: sbd, moi: c.$('#ycT').value, lyDo: c.$('#ycL').value });
      c.close(); toast('Đã gửi yêu cầu cho cô', 'success');
    } }] });
}

/* ---------------- phân tích chuyên cần một nhóm (cô) ---------------- */
async function screenDdNhom(params) {
  var v = V(), ma = params.ma;
  swap(v, skPage());
  var a;
  try { a = await Api.call('ddPhanTich', { maNhom: ma }); } catch (e) { swap(v, '<div class="page"><a class="back" href="#/diem-danh">' + icon('chevL') + 'Điểm danh</a>' + emptyState('alert', 'Không tải được', e.message) + '</div>'); return; }
  var T = a.tongQuan, sortKey = 'tiLe';
  var heat = function () {
    var hs = a.hocSinh.slice();
    if (sortKey === 'ten') hs.sort(function (x, y) { return x.sbd < y.sbd ? -1 : 1; });
    return '<div class="table-wrap"><table class="tbl heat-tbl"><thead><tr><th>Học sinh</th>' + a.ngayGan.map(function (n) { return '<th class="c small">' + fmtDate(n).slice(0, 5) + '</th>'; }).join('') +
      '<th class="r">Tỉ lệ</th><th class="r">Vắng KP</th></tr></thead><tbody>' + hs.map(function (h) {
        var pad = a.ngayGan.length - h.gan.length;
        return '<tr class="' + (h.duoiNguong ? '' : '') + '"><td><b style="font-weight:600">' + esc(h.ten) + '</b><div class="small muted sbd">' + esc(h.sbd) + '</div></td>' +
          new Array(Math.max(0, pad)).fill('<td class="h"><span class="dot none"></span></td>').join('') +
          h.gan.map(function (t) { return '<td class="h"><span class="dot ' + (t || 'none') + '" title="' + esc(DDT[t] || 'chưa ghi') + '"></span></td>'; }).join('') +
          '<td class="r num"><b style="color:' + (h.tiLe === null ? 'var(--muted)' : h.duoiNguong ? 'var(--red)' : 'var(--green)') + '">' + (h.tiLe === null ? '—' : fmtScore(h.tiLe) + '%') + '</b></td><td class="r num">' + h.dem.K + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  };
  var maxN = Math.max(1, a.siSo);
  swap(v, '<div class="page"><a class="back" href="#/diem-danh">' + icon('chevL') + 'Điểm danh</a>' +
    '<div class="page-head"><div class="titles"><h1>Chuyên cần: ' + esc(a.tenNhom) + '</h1>' + kv([['Sĩ số', a.siSo], ['Ngưỡng chuyên cần', a.nguong + '%']]) + '</div>' +
    '<div class="row"><a class="btn btn-primary" href="#/diem-danh/mo/' + esc(ma) + '">' + icon('check') + '<span>Điểm danh hôm nay</span></a><button class="btn" id="ddBu">' + icon('plus') + '<span>Ghi buổi khác</span></button></div></div>' +
    '<div class="grid grid-4 stagger" style="margin-bottom:16px">' +
    '<div class="kpi"><div class="v num" data-c="' + T.soBuoi + '" data-d="0">0</div><div class="l">buổi đã điểm danh</div></div>' +
    '<div class="kpi ' + (T.tiLe !== null && T.tiLe < a.nguong ? 'red' : 'green') + '"><div class="v num">' + (T.tiLe === null ? '—' : fmtScore(T.tiLe) + '%') + '</div><div class="l">tỉ lệ đi học trung bình</div></div>' +
    '<div class="kpi ' + (T.dem.K ? 'red' : '') + '"><div class="v num" data-c="' + T.dem.K + '" data-d="0">0</div><div class="l">lượt vắng không phép</div></div>' +
    '<div class="kpi ' + (T.duoiNguong ? 'amber' : '') + '"><div class="v num" data-c="' + T.duoiNguong + '" data-d="0">0</div><div class="l">em dưới ngưỡng</div></div></div>' +
    (a.yeuCau.length ? '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Yêu cầu sửa chờ cô duyệt (' + a.yeuCau.length + ')</h3></div><div class="stack">' + a.yeuCau.map(function (y) {
      var hs = a.hocSinh.find(function (h) { return h.sbd === y.sbd; });
      return '<div class="panel" data-id="' + esc(y.id) + '" style="padding:14px">' + kv([['Học sinh', (hs ? hs.ten + ' ' : '') + '(' + y.sbd + ')'], ['Buổi', fmtDate(y.maBuoi.slice(-10))], ['Đang ghi', DDT[y.cu] || y.cu], ['Sửa thành', DDT[y.moi] || y.moi, 'blue'], ['Người gửi', y.nguoiGui], y.lienHe ? ['Liên hệ', y.lienHe] : null]) +
        '<p style="margin-top:8px">' + esc(y.lyDo) + '</p><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm yc-ok">' + icon('check') + '<span>Duyệt</span></button><button class="btn btn-sm btn-ghost yc-no">' + icon('x') + '<span>Từ chối</span></button></div></div>';
    }).join('') + '</div></div>' : '') +
    '<div class="grid grid-2" style="margin-bottom:16px"><div class="panel"><div class="panel-head"><h3>Tỉ lệ đi học từng buổi</h3></div>' +
    (a.buoi.length ? '<div class="bars">' + a.buoi.slice(-15).map(function (b, i) { var p = b.tiLe; return '<div class="b ' + (p < a.nguong ? 'low' : '') + '" style="height:' + Math.max(3, p) + '%;animation-delay:' + i * 30 + 'ms;cursor:pointer" data-id="' + esc(b.maBuoi) + '" title="' + fmtDate(b.ngay) + ': ' + p + '%"><span>' + Math.round(p) + '</span></div>'; }).join('') + '</div>' +
      '<div class="bars-x">' + a.buoi.slice(-15).map(function (b) { return '<span>' + fmtDate(b.ngay).slice(0, 5) + '</span>'; }).join('') + '</div>' : emptyState('chart', 'Chưa có buổi nào', '')) + '</div>' +
    '<div class="panel"><div class="panel-head"><h3>Cảnh báo (' + a.coCanhBao.length + ')</h3><span class="small muted">để phát hiện điểm danh sai, bao che</span></div>' +
    (a.coCanhBao.length ? '<div class="stack" style="gap:8px;max-height:360px;overflow:auto">' + a.coCanhBao.slice(0, 30).map(function (c) {
      return '<a class="flag" href="#/diem-danh/buoi/' + esc(c.maBuoi) + '" style="color:inherit;text-decoration:none">' + icon('alert') + '<div>' + kv([['Ngày', fmtDate(c.ngay)], ['Học sinh', (c.ten || '') + ' (' + c.sbd + ')']]) + '<div style="margin-top:2px">' + esc(c.msg) + '</div></div></a>';
    }).join('') + '</div>' : emptyState('okc', 'Không có gì bất thường', 'Web tự đối chiếu với bài kiểm tra cùng ngày và các lần sửa sau khi đã gửi.')) + '</div></div>' +
    '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Từng em qua các buổi gần đây</h3><div class="seg" id="ddSort"><button data-s="tiLe" class="active">Đi học ít trước</button><button data-s="ten">Theo SBD</button></div></div>' +
    '<div class="cc-legend" style="margin-bottom:10px"><span><i style="background:var(--green)"></i>Có mặt</span><span><i style="background:var(--amber)"></i>Đi muộn</span><span><i style="background:#3B7BE0"></i>Vắng có phép</span><span><i style="background:var(--red)"></i>Vắng không phép</span></div><div id="ddHeat">' + heat() + '</div></div>' +
    '<div class="grid grid-2"><div class="panel"><div class="panel-head"><h3>Lớp trưởng điểm danh hộ</h3><button class="btn btn-sm" id="ltAdd">' + icon('plus') + '<span>Thêm</span></button></div>' +
    (a.lopTruong.length ? '<div class="list">' + a.lopTruong.map(function (l) {
      return '<div class="item" data-u="' + esc(l.username) + '"><div class="grow"><div class="t">' + esc(l.ten) + '</div><div class="s">' + kv([['Tài khoản', l.username], ['Trạng thái', l.active ? 'Hoạt động' : 'Đã khóa', l.active ? 'good' : 'bad']]) + '</div></div><div class="menu"><button class="btn btn-ghost btn-icon btn-sm lt-more" aria-label="Thao tác">' + icon('more') + '</button></div></div>';
    }).join('') + '</div>' : '<p class="small muted">Chưa có. Thêm một em làm lớp trưởng để em ấy điểm danh hộ cô bằng điện thoại.</p>') + '</div>' +
    '<div class="panel"><div class="panel-head"><h3>Các buổi đã ghi</h3></div>' + (a.buoi.length ? '<div class="list" style="max-height:380px;overflow:auto">' + a.buoi.slice().reverse().map(function (b) {
      return '<a class="item" href="#/diem-danh/buoi/' + esc(b.maBuoi) + '"><div class="grow"><div class="t">' + fmtDate(b.ngay) + '</div><div class="s">' + kv([['Có mặt', b.dem.C + b.dem.M], ['Vắng', b.dem.P + b.dem.K, b.dem.K ? 'bad' : ''], ['Tỉ lệ', b.tiLe + '%']]) + '</div></div>' + ddBadge(b.trangThai) + icon('chevR', 'chev') + '</a>';
    }).join('') + '</div>' : emptyState('clock', 'Chưa có buổi nào', '')) + '</div></div></div>');
  $$('.kpi .v[data-c]', v).forEach(function (el) { countUp(el, Number(el.dataset.c), 700, 0); });
  $$('.bars .b[data-id]').forEach(function (el) { el.onclick = function () { Router.go('/diem-danh/buoi/' + el.dataset.id); }; });
  $$('#ddSort button').forEach(function (bt) { bt.onclick = function () { sortKey = bt.dataset.s; $$('#ddSort button').forEach(function (x) { x.classList.toggle('active', x === bt); }); $('#ddHeat').innerHTML = heat(); }; });
  $$('.yc-ok, .yc-no').forEach(function (bt) {
    bt.onclick = function () {
      var id = bt.closest('[data-id]').dataset.id, ok = bt.classList.contains('yc-ok');
      busy(bt, async function () { await Api.call('ddDuyet', { id: id, dongY: ok }); await screenDdNhom(params); }, { ok: ok ? 'Đã duyệt và sửa điểm danh' : 'Đã từ chối yêu cầu' });
    };
  });
  $('#ddBu').onclick = function () {
    var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    Modal.open({ title: 'Ghi điểm danh cho ngày khác', body: '<p class="small muted" style="margin-bottom:10px">Dùng để ghi bù buổi cô quên điểm danh. Mọi thay đổi ở buổi cũ cần ghi lý do và được lưu nhật ký.</p><div class="field"><label>Ngày học</label><input class="input" type="date" id="buNgay" max="' + today + '" value="' + today + '"></div>',
      actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Mở buổi', kind: 'btn-primary', onClick: function (c) { var n = c.$('#buNgay').value; c.close(); Router.go('/diem-danh/mo/' + ma + '/' + n); } }] });
  };
  $('#ltAdd').onclick = function () { ltAddModal(ma, a, function () { screenDdNhom(params); }); };
  $$('.lt-more').forEach(function (bt) {
    bt.onclick = function (e) {
      e.stopPropagation();
      var un = bt.closest('[data-u]').dataset.u, l = a.lopTruong.find(function (x) { return x.username === un; });
      popMenu(bt, [
        { label: 'Đặt lại mật khẩu', icon: 'key', onClick: function () { busy(null, async function () { var r = await Api.call('ltSua', { username: un, datLai: true }); ltPwModal(un, r.matKhau, l.ten); }); } },
        { label: l.active ? 'Khóa (thôi làm lớp trưởng tạm thời)' : 'Mở khóa', icon: 'lock', onClick: function () { busy(null, async function () { await Api.call('ltSua', { username: un, active: !l.active }); screenDdNhom(params); }, { ok: l.active ? 'Đã khóa' : 'Đã mở khóa' }); } },
        '-',
        { label: 'Xóa tài khoản lớp trưởng', icon: 'trash', danger: true, onClick: async function () {
          if (!(await Modal.confirm({ title: 'Xóa tài khoản ' + un + '?', message: 'Em ấy không đăng nhập được nữa. Lịch sử điểm danh vẫn giữ.', confirmText: 'Xóa', danger: true }))) return;
          busy(null, async function () { await Api.call('ltSua', { username: un, xoa: true }); screenDdNhom(params); }, { ok: 'Đã xóa' });
        } }
      ]);
    };
  });
}

function ltPwModal(username, pw, ten) {
  var url = location.href.replace(/#.*$/, '');
  Modal.open({ title: 'Tài khoản lớp trưởng', body: '<p style="margin-bottom:12px">Gửi cho <b>' + esc(ten) + '</b> thông tin đăng nhập sau. Lần đầu đăng nhập em ấy sẽ phải đổi mật khẩu.</p>' +
    '<div class="kv tiles"><div><dt>Trang đăng nhập</dt><dd style="font-size:13px;word-break:break-all">' + esc(url) + '</dd></div><div><dt>Tài khoản</dt><dd>' + esc(username) + '</dd></div><div><dt>Mật khẩu tạm</dt><dd>' + esc(pw) + '</dd></div></div>',
    actions: [{ label: 'Chép để gửi', kind: '', icon: 'copy', onClick: function () { try { navigator.clipboard.writeText('Trang: ' + url + '\nTài khoản: ' + username + '\nMật khẩu: ' + pw); toast('Đã chép', 'success'); } catch (e) {} } }, { label: 'Xong', kind: 'btn-primary' }] });
}
function ltAddModal(ma, a, after) {
  var co = {}; a.lopTruong.forEach(function (l) { co[l.username.slice(2)] = 1; });
  var list = a.hocSinh.filter(function (h) { return !co[h.sbd]; }).sort(function (x, y) { return x.sbd < y.sbd ? -1 : 1; });
  Modal.open({ title: 'Thêm lớp trưởng ' + a.tenNhom, body: '<p class="small muted" style="margin-bottom:10px">Em được chọn có tài khoản riêng, chỉ điểm danh được buổi hôm nay của nhóm này. Cô vẫn kiểm tra, chốt, và thấy mọi thay đổi em ấy làm.</p>' +
    '<div class="field"><label>Chọn học sinh</label><select class="input" id="ltSbd">' + list.map(function (h) { return '<option value="' + esc(h.sbd) + '">' + esc(h.sbd + ' ' + h.ten) + '</option>'; }).join('') + '</select></div>',
    actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Tạo tài khoản', kind: 'btn-primary', onClick: async function (c) {
      var sbd = c.$('#ltSbd').value, h = list.find(function (x) { return x.sbd === sbd; });
      var r = await Api.call('ltTao', { maNhom: ma, sbd: sbd });
      c.close(); ltPwModal(r.username, r.matKhau, h ? h.ten : sbd); after && after();
    } }] });
}

window.registerDdRoutes = function () {
  Router.on('/diem-danh', screenDdHome, { nav: 'diem-danh' });
  Router.on('/diem-danh/mo/:ma', screenDdMo, { nav: 'diem-danh' });
  Router.on('/diem-danh/mo/:ma/:ngay', screenDdMo, { nav: 'diem-danh' });
  Router.on('/diem-danh/buoi/:id', screenDdBuoi, { nav: 'diem-danh' });
  Router.on('/diem-danh/nhom/:ma', function (p) { return isLT() ? Router.go('/diem-danh') : screenDdNhom(p); }, { nav: 'diem-danh' });
};
