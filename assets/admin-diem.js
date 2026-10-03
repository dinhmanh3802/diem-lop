/* =====================================================================
   SỔ ĐIỂM — điểm: nhập file TNMaker, đối soát, kết quả, sửa điểm,
   chờ xử lý, lịch sử, xuất Excel, thống kê
   ===================================================================== */
'use strict';

var EX = { imp: null, res: null };

/* ---------------- nhập file điểm ---------------- */
async function openScoreImport(file, b) {
  var m = Modal.open({ title: 'Đang đọc file điểm', dismissible: false, body: '<div class="row"><span class="spin"></span><span id="impMsg">Đang mở file…</span></div>' });
  var parsed;
  try {
    var X = await needXLSX();
    var wb = X.read(await file.arrayBuffer(), { type: 'array' });
    var find = function (name) { return wb.SheetNames.find(function (n) { return nfc(n).trim().toLowerCase() === name; }); };
    var sN = find('bảng điểm tổng') || wb.SheetNames[0], tN = find('thống kê');
    var aoa = function (n) { return X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); };
    parsed = parseTnmakerAoa(aoa(sN), tN ? aoa(tN) : null);
  } catch (e) { m.close(); toast('Không đọc được file: ' + ((e && e.message) || e), 'error'); return; }
  m.$('#impMsg').textContent = 'Đang đối chiếu ' + parsed.rows.length + ' dòng với danh sách lớp…';
  try {
    var pv = await Api.call('previewDiem', { maBai: b.maBai, rows: parsed.rows, keys: parsed.keys, shape: parsed.shape }, { timeout: 90000 });
    m.close();
    EX.imp = { b: b, file: file.name, parsed: parsed, pv: pv, dec: {}, mode: 'merge' };
    initDecisions(EX.imp);
    Router.go('/bai/' + b.maBai + '/nhap-diem');
  } catch (e) { m.close(); toastErr(e); }
}
window.openScoreImport = openScoreImport;

function initDecisions(imp) {
  var first = {};
  imp.pv.rows.forEach(function (r) {
    var codes = r.issues.map(function (x) { return x.code; }), d = { a: 'keep' };
    if (codes.indexOf('KHONG_CO_SBD') !== -1 || codes.indexOf('TRUNG_DS') !== -1) d = { a: 'defer' };
    else if (codes.indexOf('DA_SUA_TAY') !== -1) d = { a: 'skip' };
    else if (codes.indexOf('DA_GAN') !== -1 && r.daGan) d = { a: 'assign', to: r.daGan };
    else if (codes.indexOf('DA_CHUYEN') !== -1 && r.goiY) d = { a: 'assign', to: r.goiY };
    if (codes.indexOf('TRUNG_FILE') !== -1) { if (first[r.sbd] !== undefined) d = { a: 'skip' }; else first[r.sbd] = r.i; }
    imp.dec[r.i] = d;
  });
}
function decValue(d) { return d.a === 'assign' ? 'assign:' + d.to : d.a; }
function parseDec(v) { return v.indexOf('assign:') === 0 ? { a: 'assign', to: v.slice(7) } : { a: v }; }
function decOptions(r) {
  var pv = EX.imp.pv, codes = r.issues.map(function (x) { return x.code; }), opts = [];
  var sua = codes.indexOf('DA_SUA_TAY') !== -1, loi = codes.indexOf('KHONG_CO_SBD') !== -1 || codes.indexOf('TRUNG_DS') !== -1;
  if (!loi) opts.push(['keep', sua ? 'Ghi đè bằng điểm trong file' : 'Ghi như trong file']);
  if (!sua) opts.push(['defer', 'Để xử lý sau (giữ trong mục Chờ xử lý)']);
  if (r.daGan) opts.push(['assign:' + r.daGan, 'Gán lại cho SBD ' + r.daGan + ' như lần trước']);
  var pfx = r.sbd.slice(0, 3), cand = pv.absent.filter(function (a) { return a.sbd.slice(0, 3) === pfx; });
  if (r.goiY && !cand.find(function (a) { return a.sbd === r.goiY; })) opts.push(['assign:' + r.goiY, 'Gán sang SBD mới ' + r.goiY]);
  cand.forEach(function (a) { opts.push(['assign:' + a.sbd, 'Gán cho ' + a.sbd + ' ' + ((a.ho || '') + ' ' + (a.ten || '')).trim()]); });
  opts.push(['skip', sua ? 'Giữ bản đã sửa tay' : 'Bỏ hẳn dòng này (không lưu)']);
  return opts;
}
function finalRows() {
  var imp = EX.imp, out = [];
  imp.pv.rows.forEach(function (r) {
    var d = imp.dec[r.i] || { a: 'keep' };
    if (d.a === 'skip' || d.a === 'defer') return;
    out.push(Object.assign({}, imp.parsed.rows[r.i], { sbd: d.a === 'assign' ? d.to : r.sbd, srcSbd: r.sbd }));
  });
  return out;
}
function deferredRows() {
  var imp = EX.imp, out = [];
  imp.pv.rows.forEach(function (r) {
    if ((imp.dec[r.i] || {}).a !== 'defer') return;
    var first = r.issues[0] || {};
    out.push(Object.assign({}, imp.parsed.rows[r.i], { lyDo: first.code || '', ghiChu: first.msg || '' }));
  });
  return out;
}
function dupSbd(rows) { var seen = {}, dup = []; rows.forEach(function (r) { if (seen[r.sbd]) dup.push(r.sbd); seen[r.sbd] = 1; }); return Array.from(new Set(dup)); }

function screenReconcile(params) {
  var v = V(), imp = EX.imp;
  if (!imp || String(imp.b.maBai) !== String(params.id)) { Router.go('/bai/' + params.id); return; }
  var pv = imp.pv, p = imp.parsed, bad = pv.rows.filter(function (r) { return r.issues.length; });
  var maDes = Array.from(new Set(pv.rows.map(function (r) { return r.maDe; }))).sort().join(', '), dc = pv.doiChieu;
  var warns = [];
  (p.warnings || []).forEach(function (w) { warns.push(esc(w)); });
  if (pv.shapeWarn) warns.push(esc(pv.shapeWarn));
  pv.keyConflicts.forEach(function (k) { warns.push('Mã ' + esc(k.maDe) + ': đáp án trên web khác file ở ' + k.soCau + ' câu (' + k.chiTiet.map(esc).join('; ') + '). Web lấy đáp án trong file vì điểm đã chấm theo nó.'); });
  if (p.tenBai && nfc(p.tenBai).trim() !== nfc(imp.b.tenBai).trim()) warns.push('Tên bài trong file là "' + esc(p.tenBai) + '", khác tên bài trên web. Kiểm tra xem có chọn nhầm file không.');
  var rows = bad.map(function (r) {
    var name = r.ho || r.ten ? esc(((r.ho || '') + ' ' + (r.ten || '')).trim()) : '<span class="muted">không rõ</span>';
    var cur = decValue(imp.dec[r.i]);
    return '<tr><td><div class="sbd" style="font-weight:650">' + esc(r.sbd) + '</div><div class="small">' + name + '</div></td><td class="c">' + esc(r.maDe) + '</td><td class="r num"><b>' + fmtScore(r.tong) + '</b></td>' +
      '<td class="small">' + r.issues.map(function (x) { return '<div style="color:' + (x.level === 'error' ? 'var(--red)' : 'var(--amber)') + '">' + esc(x.msg) + '</div>'; }).join('') + '</td>' +
      '<td><select class="input input-sm impDec" data-i="' + r.i + '" style="min-width:220px">' + decOptions(r).map(function (o) { return '<option value="' + esc(o[0]) + '" ' + (o[0] === cur ? 'selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></td></tr>';
  }).join('');
  swap(v, '<div class="page"><a class="back" href="#/bai/' + esc(imp.b.maBai) + '">' + icon('chevL') + esc(imp.b.tenBai) + '</a>' +
    '<div class="page-head"><div class="titles"><h1>Đối chiếu file điểm</h1><div class="sub">' + esc(imp.file) + ': ' + pv.rows.length + ' dòng, mã đề ' + esc(maDes) + '. Chưa ghi gì cho tới khi bấm "Ghi điểm".</div></div></div>' +
    '<div class="grid grid-4 stagger" style="margin-bottom:16px">' +
    '<div class="kpi green"><div class="v">' + (pv.rows.length - bad.length) + '</div><div class="l">dòng khớp danh sách</div></div>' +
    '<div class="kpi ' + (bad.length ? 'amber' : '') + '"><div class="v">' + bad.length + '</div><div class="l">dòng cần xem</div></div>' +
    '<div class="kpi"><div class="v">' + pv.absent.length + '</div><div class="l">em có tên, không có điểm</div></div>' +
    '<div class="kpi ' + (dc.lech ? 'red' : 'blue') + '"><div class="v">' + (dc.khop + dc.lech ? dc.khop + '/' + (dc.khop + dc.lech) : '—') + '</div><div class="l">khớp điểm TNMaker khi web chấm lại</div></div></div>' +
    (warns.length ? '<div class="note warn" style="margin-bottom:14px">' + icon('alert') + '<div>' + warns.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div></div>' : '') +
    (pv.choXuLy ? '<div class="note blue" style="margin-bottom:14px">' + icon('info') + '<div>Bài đang có ' + pv.choXuLy + ' dòng chờ xử lý từ lần nhập trước. Dòng nào có SBD trùng file này sẽ được thay theo lựa chọn bên dưới.</div></div>' : '') +
    (bad.length ? '<div class="panel" style="padding:0;overflow:hidden"><div style="padding:16px 18px 8px"><h3>Dòng cần quyết định</h3><p class="small muted" style="margin-top:4px">Chưa quyết được (vd em mới học chưa có trong danh sách) cứ để "Để xử lý sau": điểm được giữ lại, thêm em vào danh sách rồi ghép sau.</p></div>' +
      '<div class="table-wrap" style="border:0;border-top:1px solid var(--line);border-radius:0"><table class="tbl"><thead><tr><th>SBD, họ tên</th><th class="c">Mã</th><th class="r">Điểm</th><th>Vấn đề</th><th>Cách xử lý</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      : '<div class="note green">' + icon('okc') + '<div>Mọi dòng đều khớp danh sách lớp.</div></div>') +
    (pv.absent.length ? '<details class="panel" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Có tên trong danh sách nhưng không có điểm trong file (' + pv.absent.length + ' em)</summary><p class="small" style="margin-top:10px;columns:2">' +
      pv.absent.map(function (a) { return esc(a.sbd) + ' ' + esc(((a.ho || '') + ' ' + (a.ten || '')).trim()); }).join('<br>') + '</p><p class="small muted">Các em này hiện là "Vắng", nhập tay điểm sau được.</p></details>' : '') +
    (pv.existing.count ? '<div class="panel stack" style="margin-top:16px"><h3>Bài đã có ' + pv.existing.count + ' kết quả</h3>' +
      '<label class="row small"><input type="radio" name="impMode" value="merge" checked> Cập nhật các em có trong file, giữ nguyên các em khác</label>' +
      '<label class="row small"><input type="radio" name="impMode" value="replace"> Xóa hết kết quả cũ rồi nhập lại' + (pv.existing.edited.length ? ' (mất cả ' + pv.existing.edited.length + ' bản sửa tay)' : '') + '</label></div>' : '') +
    '<div class="panel row" style="margin-top:16px;position:sticky;bottom:12px;box-shadow:var(--shadow-pop)"><span id="impCount" class="grow small"></span>' +
    '<a class="btn btn-ghost" href="#/bai/' + esc(imp.b.maBai) + '">Hủy</a><button class="btn btn-primary btn-lg" id="impGo">' + icon('check') + '<span>Ghi điểm</span></button></div></div>');
  var upd = function () { var n = finalRows().length, d = deferredRows().length; $('#impCount').innerHTML = 'Sẽ ghi <b>' + n + '</b> dòng, để xử lý sau <b>' + d + '</b>, bỏ hẳn <b>' + (pv.rows.length - n - d) + '</b>'; };
  $$('.impDec').forEach(function (s) { s.onchange = function () { imp.dec[+s.dataset.i] = parseDec(s.value); upd(); }; });
  upd();
  $('#impGo').onclick = async function () {
    var rowsF = finalRows(), deferred = deferredRows(), dup = dupSbd(rowsF);
    if (dup.length) { toast('SBD ' + dup.join(', ') + ' bị trùng sau khi xử lý. Chọn "Bỏ hẳn" cho một trong các dòng.', 'error'); return; }
    var mode = ($('input[name=impMode]:checked') || {}).value || 'merge';
    if (!rowsF.length && !deferred.length && mode !== 'replace') { toast('Không có dòng nào để ghi', 'error'); return; }
    if (mode === 'replace' && !(await Modal.confirm({ title: 'Xóa hết kết quả cũ?', message: 'Mọi kết quả cũ của bài (kể cả bản sửa tay) bị xóa rồi ghi lại từ file.', confirmText: 'Xóa và ghi lại', danger: true }))) return;
    busy(this, async function () {
      var r = await Api.call('commitDiem', { maBai: imp.b.maBai, rows: rowsF, deferred: deferred, purge: pv.rows.map(function (x) { return x.sbd; }), keys: p.keys, mode: mode, tenFile: imp.file }, { timeout: 90000 });
      EX.imp = null; Api.invalidate('listBai');
      toast('Đã ghi ' + r.soDong + ' kết quả' + (r.soChoXuLy ? ', ' + r.soChoXuLy + ' dòng chờ xử lý' : ''), 'success');
      Router.go('/bai/' + imp.b.maBai + '/ket-qua');
    });
  };
}

/* ---------------- kết quả ---------------- */
async function screenResults(params) {
  var v = V(), id = params.id;
  var wantTab = params.tab === 'cho' ? '#' : null;
  if (!EX.res || String(EX.res.data.bai.maBai) !== String(id)) swap(v, skPage());
  try {
    var data = await Api.call('getKetQua', { maBai: id, fresh: !!params.fresh });
    var cx = (data.choXuLy || []).length, keep = EX.res && String(EX.res.data.bai.maBai) === String(id) ? EX.res : null;
    var tab = wantTab || (keep && keep.tab) || null;
    if (tab === '#' && !cx) tab = null;
    if (tab && tab !== '#' && tab !== '*' && !data.groups.some(function (g) { return g.maNhom === tab; })) tab = null;
    if (!tab) tab = data.groups.length ? data.groups[0].maNhom : (cx ? '#' : '*');
    EX.res = { data: data, tab: tab, q: keep ? keep.q : '', sort: keep ? keep.sort : 'sbd' };
    drawResults();
  } catch (e) { swap(v, '<div class="page"><a class="back" href="#/bai/' + esc(id) + '">' + icon('chevL') + 'Quay lại</a>' + emptyState('alert', 'Không tải được kết quả', e.message) + '</div>'); }
}
function avgTong(list) { var x = list.filter(function (s) { return s.kq; }).map(function (s) { return s.kq.tong; }); return x.length ? Math.round(x.reduce(function (a, b) { return a + b; }, 0) / x.length * 100) / 100 : null; }
function findStudent(sbd) {
  var d = EX.res.data;
  for (var i = 0; i < d.groups.length; i++) { var s = d.groups[i].students.find(function (x) { return x.sbd === sbd; }); if (s) return s; }
  return d.orphan.find(function (x) { return x.sbd === sbd; }) || null;
}

function drawResults() {
  var v = V(), R = EX.res, d = R.data, b = d.bai, tab = R.tab, pub = b.trangThai === 'Đã công bố';
  var cxN = (d.choXuLy || []).length;
  var tabs = (cxN ? '<button data-t="#" class="' + (tab === '#' ? 'active' : '') + '" style="color:var(--amber)">Chờ xử lý<span class="n" style="color:var(--amber)">' + cxN + '</span></button>' : '') +
    d.groups.map(function (g) { return '<button data-t="' + esc(g.maNhom) + '" class="' + (tab === g.maNhom ? 'active' : '') + '">' + esc(g.tenNhom) + '<span class="n">' + g.students.filter(function (s) { return s.kq; }).length + '/' + g.students.length + '</span></button>'; }).join('') +
    (d.orphan.length ? '<button data-t="*" class="' + (tab === '*' ? 'active' : '') + '">Khác<span class="n">' + d.orphan.length + '</span></button>' : '');
  var g = d.groups.find(function (x) { return x.maNhom === tab; });
  var head = '<div class="page"><a class="back" href="#/bai/' + esc(b.maBai) + '">' + icon('chevL') + esc(b.tenBai) + '</a>' +
    '<div class="page-head"><div class="titles"><h1>Kết quả ' + (pub ? '<span class="badge ok">Đã công bố</span>' : '<span class="badge">Chưa công bố</span>') + '</h1>' + kv([['Bài', b.tenBai], ['Ngày kiểm tra', fmtDate(b.ngay)]]) + '</div>' +
    '<div class="row"><a class="btn" href="#/bai/' + esc(b.maBai) + '/thong-ke">' + icon('chart') + '<span>Thống kê</span></a>' +
    '<div class="menu"><button class="btn" id="rMore">' + icon('download') + '<span>Xuất</span></button></div>' +
    '<button class="btn ' + (pub ? '' : 'btn-primary') + '" id="rPub">' + icon(pub ? 'eyeOff' : 'eye') + '<span>' + (pub ? 'Ẩn điểm' : 'Công bố') + '</span></button></div></div>' +
    (cxN && tab !== '#' ? '<div class="note warn" style="margin-bottom:14px">' + icon('alert') + '<div class="grow">Còn <b>' + cxN + '</b> dòng điểm chưa gán cho học sinh nào, chưa tính vào bảng dưới.</div><button class="btn btn-sm" id="goPend">Xử lý ngay</button></div>' : '') +
    '<div class="row" style="margin-bottom:14px"><div class="seg" id="rTabs">' + tabs + '</div></div>';
  var body;
  if (tab === '#') body = pendingHtml(d);
  else {
    var list = tab === '*' ? d.orphan.map(function (o) { return { sbd: o.sbd, ho: '', ten: '(không còn trong danh sách)', kq: o.kq }; }) : (g ? g.students : []);
    var q = (R.q || '').toLowerCase();
    var shown = list.filter(function (s) { return !q || (s.sbd + ' ' + s.ho + ' ' + s.ten).toLowerCase().indexOf(q) !== -1; });
    if (R.sort === 'diem') shown = shown.slice().sort(function (x, y) { return (y.kq ? y.kq.tong : -1) - (x.kq ? x.kq.tong : -1); });
    var a = avgTong(list), n = list.filter(function (s) { return s.kq; }).length;
    body = '<div class="grid grid-4" style="margin-bottom:14px"><div class="kpi"><div class="v num">' + n + '<span class="muted" style="font-size:18px">/' + list.length + '</span></div><div class="l">em có điểm</div></div>' +
      '<div class="kpi blue"><div class="v num">' + fmtScore(a) + '</div><div class="l">điểm trung bình</div></div>' +
      '<div class="kpi green"><div class="v num">' + fmtScore(n ? Math.max.apply(null, list.filter(function (s) { return s.kq; }).map(function (s) { return s.kq.tong; })) : null) + '</div><div class="l">cao nhất</div></div>' +
      '<div class="kpi"><div class="v num">' + (list.length - n) + '</div><div class="l">vắng</div></div></div>' +
      '<div class="row" style="margin-bottom:10px"><input class="input input-sm" id="rq" placeholder="Tìm tên hoặc SBD" value="' + esc(R.q || '') + '" style="max-width:240px">' +
      '<div class="seg" id="rSort"><button data-s="sbd" class="' + (R.sort !== 'diem' ? 'active' : '') + '">Theo SBD</button><button data-s="diem" class="' + (R.sort === 'diem' ? 'active' : '') + '">Theo điểm</button></div>' +
      '<span class="grow"></span><button class="btn btn-sm btn-ghost" id="rHist">' + icon('clock') + '<span>Lịch sử sửa</span></button><button class="btn btn-sm btn-ghost" id="rReload">' + icon('refresh') + '<span class="hide-m">Tải lại</span></button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>SBD</th><th>Họ tên</th><th class="c">Mã</th><th class="r">Điểm</th><th class="r hide-m">P1</th><th class="r hide-m">P2</th><th class="r hide-m">P3</th><th></th></tr></thead><tbody>' +
      (shown.length ? shown.map(function (s) {
        var k = s.kq;
        return '<tr data-sbd="' + esc(s.sbd) + '" class="' + (k ? '' : 'dim') + '"><td class="sbd">' + esc(s.sbd) + '</td><td>' + esc(((s.ho || '') + ' ' + (s.ten || '')).trim()) + '</td><td class="c">' + (k ? esc(k.maDe) : '') + '</td>' +
          '<td class="r num"><b style="font-size:15px">' + (k ? fmtScore(k.tong) : '—') + '</b>' + (k && k.daSua ? ' <span title="Đã sửa tay" style="color:var(--amber)">✎</span>' : '') + '</td>' +
          '<td class="r hide-m num">' + (k ? fmtScore(k.p1) : '') + '</td><td class="r hide-m num">' + (k ? fmtScore(k.p2) : '') + '</td><td class="r hide-m num">' + (k ? fmtScore(k.p3) : '') + '</td>' +
          '<td class="act">' + (k ? '<button class="btn btn-sm btn-ghost r-edit">' + icon('pen') + '<span class="hide-m">Sửa</span></button>' : '<span class="small muted">Vắng</span> <button class="btn btn-sm r-edit">' + icon('plus') + '<span class="hide-m">Nhập tay</span></button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="8">' + emptyState('search', 'Không có học sinh khớp', '') + '</td></tr>') + '</tbody></table></div>';
  }
  swap(v, head + body + '</div>');
  $$('#rTabs button').forEach(function (bt) { bt.onclick = function () { R.tab = bt.dataset.t; drawResults(); }; });
  if ($('#goPend')) $('#goPend').onclick = function () { R.tab = '#'; drawResults(); };
  $('#rPub').onclick = function () { togglePublishBai(this, b, function () { screenResults({ id: b.maBai }); }); };
  $('#rMore').onclick = function (e) {
    e.stopPropagation();
    popMenu(this, [
      { label: 'Tải file Excel', icon: 'download', onClick: function () { exportExcel(false); } },
      { label: 'Lưu Excel vào Drive của bài', icon: 'upload', onClick: function () { exportExcel(true); } },
      { label: 'In bảng điểm', icon: 'file', onClick: function () { window.print(); } }
    ]);
  };
  if (tab === '#') { bindPending(b.maBai); return; }
  var rq = $('#rq');
  rq.oninput = debounce(function () { R.q = rq.value; drawResults(); var x = $('#rq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 200);
  $$('#rSort button').forEach(function (bt) { bt.onclick = function () { R.sort = bt.dataset.s; drawResults(); }; });
  $('#rHist').onclick = function () { historyModal(b.maBai); };
  $('#rReload').onclick = function () { busy(this, function () { return screenResults({ id: b.maBai, fresh: true }); }); };
  $$('.r-edit').forEach(function (bt) { bt.onclick = function () { var s = findStudent(bt.closest('tr').dataset.sbd) || { sbd: bt.closest('tr').dataset.sbd }; openEditor(s); }; });
}

async function exportExcel(toDrive) {
  var d = EX.res.data, cx = (d.choXuLy || []).length;
  if (cx && !(await Modal.confirm({ title: 'Còn dòng chờ xử lý', message: 'Còn ' + cx + ' dòng điểm chưa gán cho ai, sẽ không có trong file Excel. Vẫn xuất?', confirmText: 'Vẫn xuất' }))) return;
  busy(null, async function () {
    var X = await needXLSX();
    var wb = buildExportWorkbook(X, d);
    var name = 'diem - ' + String(d.bai.tenBai || 'bai').replace(/[\\\/:*?"<>|]/g, '-').trim() + '.xlsx';
    if (!toDrive) { X.writeFile(wb, name); return; }
    var data = X.write(wb, { type: 'base64', bookType: 'xlsx' });
    var r = await Api.call('luuFileDrive', { maBai: d.bai.maBai, tenFile: name, data: data }, { timeout: 90000 });
    toast('Đã lưu "' + name + '" vào Drive', 'success');
    window.open(r.url, '_blank');
  }, { ok: toDrive ? '' : 'Đã tạo file Excel' });
}

async function historyModal(maBai) {
  var m = Modal.open({ title: 'Lịch sử sửa', size: 'lg', body: '<div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line"></div>' });
  try {
    var r = await Api.call('getNhatKy', { maBai: maBai });
    m.setBody(r.nhatKy.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Người</th><th>SBD</th><th>Mục</th><th>Thay đổi</th><th>Lý do</th></tr></thead><tbody>' +
      r.nhatKy.map(function (x) { return '<tr><td class="small muted" style="white-space:nowrap">' + esc(x.thoiGian) + '</td><td>' + esc(x.nguoiSua) + '</td><td class="sbd">' + esc(x.sbd) + '</td><td>' + esc(x.truong) + '</td><td class="small">' + esc(x.cu) + ' → <b>' + esc(x.moi) + '</b></td><td class="small">' + esc(x.lyDo) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : emptyState('clock', 'Chưa có thay đổi nào', ''));
  } catch (e) { m.close(); toastErr(e); }
}

/* ---------------- mục chờ xử lý ---------------- */
function pendingHtml(d) {
  var cand = [];
  d.groups.forEach(function (g) { g.students.forEach(function (s) { if (!s.kq && s.trangThai === 'Đang học') cand.push({ sbd: s.sbd, label: s.sbd + ' ' + ((s.ho || '') + ' ' + (s.ten || '')).trim() + ' (' + g.tenNhom + ')' }); }); });
  var rows = d.choXuLy.map(function (c) {
    var m = c.match, hint = '<div>' + esc(c.ghiChu || '') + '</div>';
    if (m) hint += '<div style="color:var(--green)">Giờ SBD này đã có trong danh sách: <b>' + esc(((m.ho || '') + ' ' + (m.ten || '')).trim()) + '</b>' + (m.coKetQua ? ' (đã có điểm bài này)' : '') + (m.trangThai !== 'Đang học' ? ' (' + esc(m.trangThai) + ')' : '') + '</div>';
    if (c.trungDS) hint += '<div style="color:var(--red)">SBD vẫn đang dùng cho ' + c.trungDS + ' học sinh: sửa danh sách lớp trước.</div>';
    var list = cand.slice(), gan = m && !m.coKetQua;
    if (gan && !list.find(function (x) { return x.sbd === c.sbd; })) list.unshift({ sbd: c.sbd, label: c.sbd + ' ' + ((m.ho || '') + ' ' + (m.ten || '')).trim() });
    return '<tr data-id="' + esc(c.id) + '"><td class="sbd" style="font-weight:650">' + esc(c.sbd || '(trống)') + '</td><td class="c">' + esc(c.maDe) + '</td>' +
      '<td class="r num"><b>' + fmtScore(c.tong) + '</b><div class="small muted">' + fmtScore(c.p1) + ' / ' + fmtScore(c.p2) + ' / ' + fmtScore(c.p3) + '</div></td><td class="small">' + hint + '</td>' +
      '<td><select class="input input-sm cxSel" style="min-width:200px"><option value="">Chọn em để gán</option>' + list.map(function (x) { return '<option value="' + esc(x.sbd) + '" ' + (gan && x.sbd === c.sbd ? 'selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></td>' +
      '<td class="act"><button class="btn btn-sm btn-primary cx-assign">' + icon('check') + '<span>Gán</span></button> <button class="btn btn-sm btn-ghost cx-discard">' + icon('trash') + '</button></td></tr>';
  }).join('');
  return '<div class="panel" style="margin-bottom:14px"><div class="row"><div class="grow"><h3>Dòng điểm chưa gán cho ai</h3><p class="small muted" style="margin-top:4px">Điểm và câu trả lời vẫn được giữ nguyên ở đây. Thêm em vào danh sách lớp (hoặc sửa SBD trùng) rồi bấm "Ghép lại tự động", hoặc gán tay từng dòng.</p></div>' +
    '<button class="btn btn-primary" id="cxAuto">' + icon('sparkle') + '<span>Ghép lại tự động</span></button></div></div>' +
    '<div class="table-wrap"><table class="tbl"><thead><tr><th>SBD trong file</th><th class="c">Mã</th><th class="r">Điểm</th><th>Vì sao chưa gán được</th><th>Gán cho</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function bindPending(maBai) {
  var run = function (btn, payload, okMsg) {
    return busy(btn, async function () {
      var r = await Api.call('giaiQuyetChoXuLy', Object.assign({ maBai: maBai }, payload), { timeout: 90000 });
      if (r.errors && r.errors.length) toast(r.errors.map(function (e) { return e.msg; }).join('; '), 'error'); else toast(okMsg(r), r.resolved || r.discarded ? 'success' : 'warn');
      Api.invalidate('listBai');
      await screenResults({ id: maBai, tab: r.conLai ? 'cho' : null });
    });
  };
  $('#cxAuto').onclick = function () { run(this, { auto: true }, function (r) { return r.resolved ? 'Đã ghép ' + r.resolved + ' dòng' + (r.conLai ? ', còn ' + r.conLai + ' dòng cần gán tay' : '') : 'Chưa có dòng nào ghép được. Thêm em vào danh sách lớp hoặc sửa SBD trước.'; }); };
  $$('.cx-assign').forEach(function (b) {
    b.onclick = function () { var tr = b.closest('tr'), to = tr.querySelector('.cxSel').value; if (!to) { toast('Chọn em cần gán', 'error'); tr.querySelector('.cxSel').focus(); return; } run(b, { items: [{ id: tr.dataset.id, action: 'assign', to: to }] }, function () { return 'Đã gán điểm cho ' + to; }); };
  });
  $$('.cx-discard').forEach(function (b) {
    b.onclick = async function () {
      if (!(await Modal.confirm({ title: 'Bỏ hẳn dòng này?', message: 'Điểm và câu trả lời của dòng này bị xóa khỏi hệ thống.', confirmText: 'Bỏ hẳn', danger: true }))) return;
      run(b, { items: [{ id: b.closest('tr').dataset.id, action: 'discard' }] }, function () { return 'Đã bỏ dòng này'; });
    };
  });
}

/* ---------------- sửa điểm một em (tô phiếu) ---------------- */
function openEditor(stu) {
  var d = EX.res.data, cfg = d.bai.cauHinh, kq = stu.kq;
  var tl0 = JSON.parse(JSON.stringify(kq && kq.tl ? kq.tl : { p1: [], p2: [], p3: [] }));
  var ed = { maDe0: kq ? kq.maDe : '', maDe: kq ? kq.maDe : ((cfg.maDeList || [])[0] || ''), tl: JSON.parse(JSON.stringify(tl0)) };
  var n1 = cfg.p1 && cfg.p1.on ? cfg.p1.soCau : 0, n2 = cfg.p2 && cfg.p2.on ? cfg.p2.soCau : 0, n3 = cfg.p3 && cfg.p3.on ? cfg.p3.soCau : 0;
  for (var i = 0; i < n1; i++) ed.tl.p1[i] = ed.tl.p1[i] || '';
  for (i = 0; i < n2; i++) ed.tl.p2[i] = ((ed.tl.p2[i] || '') + '____').slice(0, 4);
  for (i = 0; i < n3; i++) ed.tl.p3[i] = ed.tl.p3[i] || '';
  var orig = JSON.stringify(ed.tl);
  var name = ((stu.ho || '') + ' ' + (stu.ten || '')).trim();
  var m = Modal.open({ title: (kq ? 'Sửa kết quả: ' : 'Nhập tay: ') + (name || stu.sbd) + ' (' + stu.sbd + ')', size: 'xl', body: '', actions: [] });
  var draw = function () {
    var key = (d.keys || {})[ed.maDe];
    var ma = (cfg.maDeList || []).concat(ed.maDe0 && (cfg.maDeList || []).indexOf(ed.maDe0) === -1 ? [ed.maDe0] : []);
    var h = '<div class="row" style="margin-bottom:12px"><div class="field"><label>Mã đề</label><select class="input input-sm" id="eMa">' + ma.map(function (x) { return '<option ' + (x === ed.maDe ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      (kq ? '<div class="small muted grow">Hiện tại: <b>' + fmtScore(kq.tong) + '</b> điểm (P1 ' + fmtScore(kq.p1) + ', P2 ' + fmtScore(kq.p2) + ', P3 ' + fmtScore(kq.p3) + ')</div>' : '') + '</div>';
    if (!key) h += '<div class="note warn">' + icon('alert') + '<div>Mã đề này chưa có đáp án trên hệ thống nên không tính lại được từ câu trả lời. Hãy sửa thẳng điểm ở dưới.</div></div>';
    else {
      h += '<p class="small muted" style="margin-bottom:10px">Ô viền xanh là đáp án đúng. Bấm ô tròn để đổi lựa chọn của em; web tính lại điểm khi lưu.</p>';
      if (n1) h += '<h3 style="margin:8px 0">Phần I</h3><div class="ans-grid">' + ed.tl.p1.slice(0, n1).map(function (x, i) {
        var k = (key.p1 || [])[i];
        return '<div class="q"><span class="n">' + (i + 1) + '</span>' + ['A', 'B', 'C', 'D'].map(function (o) { return '<span class="bubble e1 ' + (x === o ? 'on' : '') + (k === o ? ' key' : '') + (x === o && k !== o ? ' wrong' : '') + '" data-i="' + i + '" data-o="' + o + '">' + o + '</span>'; }).join('') + '</div>';
      }).join('') + '</div>';
      if (n2) h += '<h3 style="margin:14px 0 8px">Phần II</h3><div class="stack" style="gap:2px">' + ed.tl.p2.slice(0, n2).map(function (s, i) {
        var k = ((key.p2 || [])[i] || '');
        return '<div class="q2"><b class="small">Câu ' + (i + 1) + '</b>' + [0, 1, 2, 3].map(function (y) {
          return '<span class="y"><b>' + 'abcd'[y] + '</b>' + ['Đ', 'S'].map(function (o) { return '<span class="bubble e2 ' + (s[y] === o ? 'on' : '') + (k[y] === o ? ' key' : '') + (s[y] === o && k[y] !== o ? ' wrong' : '') + '" data-i="' + i + '" data-y="' + y + '" data-o="' + o + '">' + o + '</span>'; }).join('') + '</span>';
        }).join('') + '</div>';
      }).join('') + '</div>';
      if (n3) h += '<h3 style="margin:14px 0 8px">Phần III</h3><div class="ans-grid">' + ed.tl.p3.slice(0, n3).map(function (x, i) {
        var k = (key.p3 || [])[i] || '';
        return '<div class="q q3"><span class="n">' + (i + 1) + '</span><input class="input input-sm e3 ' + (x && x !== k ? 'is-bad' : '') + '" data-i="' + i + '" value="' + esc(x) + '" maxlength="4"><span class="small" style="color:var(--green)">' + esc(k) + '</span></div>';
      }).join('') + '</div>';
    }
    h += '<details style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Hoặc sửa thẳng điểm (không tính lại từ câu trả lời)</summary><div class="grid grid-4" style="margin-top:10px">' +
      ['tong', 'p1', 'p2', 'p3'].map(function (f) { return '<div class="field"><label>' + (f === 'tong' ? 'Tổng' : f.toUpperCase()) + '</label><input class="input input-sm eD" data-f="' + f + '" type="number" step="0.05" min="0" max="10" placeholder="' + (kq ? esc(kq[f]) : '') + '"></div>'; }).join('') +
      '</div><p class="small muted" style="margin-top:6px">Chỉ điền ô cần đổi. Chỉ điền P1/P2/P3 thì tổng tự cộng lại.</p></details>' +
      '<div class="field" style="margin-top:16px"><label>Lý do (bắt buộc, lưu vào lịch sử)</label><input class="input" id="eWhy" placeholder="vd: phúc khảo, em tô nhầm, cộng điểm…"></div>' +
      '<div class="row" style="margin-top:16px">' + (kq ? '<button class="btn btn-danger" id="eDel">' + icon('trash') + '<span>Xóa kết quả</span></button>' : '') + '<span class="grow"></span><button class="btn btn-ghost" id="eCancel">Hủy</button><button class="btn btn-primary" id="eSave">' + icon('check') + '<span>Lưu</span></button></div>';
    var why = m.$('#eWhy') ? m.$('#eWhy').value : '';
    m.setBody(h);
    m.$('#eWhy').value = why;
    m.$('#eMa').onchange = function () { ed.maDe = this.value; draw(); };
    m.$$('.e1').forEach(function (bb) { bb.onclick = function () { var i = +bb.dataset.i; ed.tl.p1[i] = ed.tl.p1[i] === bb.dataset.o ? '' : bb.dataset.o; draw(); }; });
    m.$$('.e2').forEach(function (bb) { bb.onclick = function () { var i = +bb.dataset.i, y = +bb.dataset.y, s = ed.tl.p2[i].split(''); s[y] = s[y] === bb.dataset.o ? '_' : bb.dataset.o; ed.tl.p2[i] = s.join(''); draw(); }; });
    m.$$('.e3').forEach(function (inp) { inp.onchange = function () { ed.tl.p3[+inp.dataset.i] = inp.value.replace(/\./g, ',').trim(); draw(); }; });
    m.$('#eCancel').onclick = function () { m.close(); };
    m.$('#eSave').onclick = function () {
      var lyDo = m.$('#eWhy').value.trim();
      if (!lyDo) { m.$('#eWhy').classList.add('is-bad'); m.$('#eWhy').focus(); toast('Nhập lý do sửa', 'error'); return; }
      var direct = {}, anyD = false;
      m.$$('.eD').forEach(function (x) { if (x.value !== '') { direct[x.dataset.f] = x.value; anyD = true; } });
      var ansChanged = ed.maDe !== ed.maDe0 || JSON.stringify(ed.tl) !== orig;
      var payload = { maBai: d.bai.maBai, sbd: stu.sbd, lyDo: lyDo };
      if (anyD) Object.assign(payload, direct, { maDe: ed.maDe });
      else if (ansChanged) Object.assign(payload, { maDe: ed.maDe, traLoi: ed.tl });
      else { toast('Chưa thay đổi gì', 'warn'); return; }
      busy(this, async function () {
        var r = await Api.call('editKetQua', payload);
        var s = findStudent(stu.sbd); if (s) s.kq = r.kq;
        m.close(); drawResults();
        var tr = $('tr[data-sbd="' + stu.sbd + '"]'); if (tr) tr.classList.add('flash');
        toast('Đã lưu: ' + fmtScore(r.kq.tong) + ' điểm', 'success');
      });
    };
    if (m.$('#eDel')) m.$('#eDel').onclick = async function () {
      var lyDo = m.$('#eWhy').value.trim();
      if (!lyDo) { m.$('#eWhy').classList.add('is-bad'); m.$('#eWhy').focus(); toast('Nhập lý do xóa', 'error'); return; }
      if (!(await Modal.confirm({ title: 'Xóa kết quả của ' + (name || stu.sbd) + '?', message: 'Em này sẽ hiện là Vắng.', confirmText: 'Xóa', danger: true }))) return;
      busy(this, async function () {
        await Api.call('xoaKetQua', { maBai: d.bai.maBai, sbd: stu.sbd, lyDo: lyDo });
        var s = findStudent(stu.sbd);
        if (s && Object.prototype.hasOwnProperty.call(s, 'ho')) s.kq = null; else d.orphan = d.orphan.filter(function (x) { return x.sbd !== stu.sbd; });
        m.close(); drawResults(); toast('Đã xóa kết quả', 'success');
      });
    };
  };
  draw();
}

/* ---------------- thống kê ---------------- */
async function screenStats(params) {
  var v = V(), id = params.id;
  swap(v, skPage());
  var t;
  try { t = await Api.call('thongKeBai', { maBai: id }); } catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không tải được thống kê', e.message) + '</div>'); return; }
  var TQ = t.tongQuan, nh = t.nhom;
  var color = function (p) { return p >= 70 ? 'var(--green)' : p >= 40 ? 'var(--amber)' : 'var(--red)'; };
  var hist = function (pho) {
    var mx = Math.max.apply(null, pho.concat([1]));
    return '<div class="bars">' + pho.map(function (n, i) { return '<div class="b ' + (i < 5 ? 'low' : i < 7 ? 'mid' : '') + '" style="height:' + Math.max(2, n * 100 / mx) + '%;animation-delay:' + i * 35 + 'ms">' + (n ? '<span>' + n + '</span>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="bars-x">' + pho.map(function (_, i) { return '<span>' + (i === 10 ? '10' : i + '–' + (i + 1)) + '</span>'; }).join('') + '</div>';
  };
  var state = { ma: t.theoMa.length ? t.theoMa[0].maDe : null, nhom: '' };
  var drawMa = function () {
    var M = t.theoMa.find(function (x) { return x.maDe === state.ma; });
    if (!M) return emptyState('chart', 'Chưa có chi tiết từng câu', 'File điểm cần có tab Thống kê, và bài cần có đáp án.');
    return '<div class="seg" id="sMa" style="margin-bottom:14px">' + t.theoMa.map(function (x) { return '<button data-m="' + esc(x.maDe) + '" class="' + (x.maDe === state.ma ? 'active' : '') + '">Mã ' + esc(x.maDe) + '<span class="n">' + x.n + '</span></button>'; }).join('') + '</div>' +
      (M.p1.length ? '<h3 style="margin-bottom:8px">Phần I: tỉ lệ làm đúng từng câu</h3><div class="heat" style="margin-bottom:16px">' + M.p1.map(function (c, i) {
        return '<div class="h" title="Câu ' + c.cau + ': đúng ' + c.tiLe + '%, đáp án ' + esc(c.dapAn) + (c.nhieuNhat ? ', chọn sai nhiều nhất: ' + c.nhieuNhat + ' (' + c.chon[c.nhieuNhat] + ' em)' : '') + '" style="background:' + color(c.tiLe) + ';animation-delay:' + i * 20 + 'ms">' + c.cau + '<small>' + Math.round(c.tiLe) + '%</small></div>';
      }).join('') + '</div>' +
      '<details style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:600">Bảng chọn phương án Phần I (để tìm phương án nhiễu)</summary><div class="table-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Câu</th><th class="c">Đáp án</th><th class="r">A</th><th class="r">B</th><th class="r">C</th><th class="r">D</th><th class="r">Bỏ trống</th><th class="r">Đúng</th></tr></thead><tbody>' +
      M.p1.map(function (c) { return '<tr><td>' + c.cau + '</td><td class="c"><b>' + esc(c.dapAn) + '</b></td>' + ['A', 'B', 'C', 'D', ''].map(function (o) { var s = o === c.dapAn ? 'color:var(--green);font-weight:700' : (o && o === c.nhieuNhat ? 'color:var(--red);font-weight:700' : ''); return '<td class="r num" style="' + s + '">' + c.chon[o] + '</td>'; }).join('') + '<td class="r num"><b style="color:' + color(c.tiLe) + '">' + c.tiLe + '%</b></td></tr>'; }).join('') +
      '</tbody></table></div></details>' : '') +
      (M.p2.length ? '<h3 style="margin-bottom:8px">Phần II: tỉ lệ đúng từng ý</h3><div class="stack" style="gap:10px;margin-bottom:16px">' + M.p2.map(function (c) {
        return '<div><div class="row small" style="margin-bottom:4px"><b>Câu ' + c.cau + '</b><span class="muted">đáp án ' + esc(c.dapAn) + ', đúng cả 4 ý: ' + c.tiLeDu4 + '%</span></div><div class="grid grid-4" style="gap:8px">' +
          c.y.map(function (p, y) { return '<div><div class="small muted">ý ' + 'abcd'[y] + ' ' + Math.round(p) + '%</div><div class="hbar"><i style="width:' + p + '%;background:' + color(p) + '"></i></div></div>'; }).join('') + '</div></div>';
      }).join('') + '</div>' : '') +
      (M.p3.length ? '<h3 style="margin-bottom:8px">Phần III</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Câu</th><th>Đáp án</th><th class="r">Đúng</th><th>Câu trả lời sai hay gặp</th></tr></thead><tbody>' +
        M.p3.map(function (c) { return '<tr><td>' + c.cau + '</td><td><b>' + esc(c.dapAn) + '</b></td><td class="r"><b style="color:' + color(c.tiLe) + '">' + c.tiLe + '%</b></td><td class="small">' + (c.saiHay.map(function (s) { return '<span class="badge plain" style="margin:2px">' + esc(s.gt) + ' (' + s.n + ')</span>'; }).join('') || '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '');
  };
  var trend = function () {
    if (t.xuHuong.length < 2) return '<p class="small muted">Cần ít nhất 2 bài có điểm của cùng nhóm để so sánh.</p>';
    var mas = {}; t.xuHuong.forEach(function (x) { Object.keys(x.tbNhom).forEach(function (m) { mas[m] = 1; }); });
    return '<div class="table-wrap"><table class="tbl"><thead><tr><th>Bài</th>' + Object.keys(mas).sort().map(function (m) { var g = nh.find(function (x) { return x.maNhom === m; }); return '<th class="r">' + esc(g ? g.tenNhom : m) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      t.xuHuong.map(function (x) { return '<tr style="' + (x.laBaiNay ? 'font-weight:700;background:var(--blue-soft)' : '') + '"><td>' + esc(x.tenBai) + '<div class="small muted">' + fmtDate(x.ngay) + '</div></td>' + Object.keys(mas).sort().map(function (m) { return '<td class="r num">' + fmtScore(x.tbNhom[m]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  };
  swap(v, '<div class="page"><a class="back" href="#/bai/' + esc(id) + '">' + icon('chevL') + esc(t.bai.tenBai) + '</a>' +
    '<div class="page-head"><div class="titles"><h1>Thống kê</h1>' + kv([['Bài', t.bai.tenBai], ['Ngày kiểm tra', fmtDate(t.bai.ngay)], ['Số bài làm', t.tongQuan.n]]) + '</div>' +
    '<a class="btn" href="#/bai/' + esc(id) + '/ket-qua">' + icon('sheet') + '<span>Bảng điểm</span></a></div>' +
    '<div class="grid grid-4 stagger" style="margin-bottom:16px">' +
    '<div class="kpi blue"><div class="v num" data-c="' + (TQ.tb || 0) + '">0</div><div class="l">điểm trung bình (' + TQ.n + ' em)</div></div>' +
    '<div class="kpi"><div class="v num" data-c="' + (TQ.trungVi || 0) + '">0</div><div class="l">trung vị</div></div>' +
    '<div class="kpi green"><div class="v num" data-c="' + (TQ.cao || 0) + '">0</div><div class="l">cao nhất</div></div>' +
    '<div class="kpi red"><div class="v num" data-c="' + (TQ.thap || 0) + '">0</div><div class="l">thấp nhất</div></div></div>' +
    '<div class="grid grid-2" style="margin-bottom:16px"><div class="panel"><div class="panel-head"><h3>Phổ điểm</h3><select class="input input-sm" id="sNhom" style="max-width:200px"><option value="">Tất cả nhóm</option>' + nh.map(function (g) { return '<option value="' + esc(g.maNhom) + '">' + esc(g.tenNhom) + '</option>'; }).join('') + '</select></div><div id="sHist">' + hist(TQ.pho) + '</div></div>' +
    '<div class="panel"><div class="panel-head"><h3>Theo nhóm</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Nhóm</th><th class="r">Làm bài</th><th class="r">Vắng</th><th class="r">TB</th><th class="r">P1</th><th class="r">P2</th><th class="r">P3</th></tr></thead><tbody>' +
    nh.map(function (g) { return '<tr><td>' + esc(g.tenNhom) + '</td><td class="r num">' + g.n + '</td><td class="r num">' + g.vang + '</td><td class="r num"><b>' + fmtScore(g.tb) + '</b></td><td class="r num">' + fmtScore(g.p1) + '/' + fmtScore(t.mx[0]) + '</td><td class="r num">' + fmtScore(g.p2) + '/' + fmtScore(t.mx[1]) + '</td><td class="r num">' + fmtScore(g.p3) + '/' + fmtScore(t.mx[2]) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    (t.khoNhat.length ? '<h3 style="margin:16px 0 8px">Câu khó nhất</h3><div class="stack" style="gap:8px">' + t.khoNhat.slice(0, 5).map(function (k) { return '<div><div class="row small"><b>Phần ' + k.phan + ' câu ' + k.cau + '</b><span class="muted">mã ' + esc(k.maDe) + '</span><span class="grow"></span><b style="color:' + color(k.tiLe) + '">' + k.tiLe + '% đúng</b></div><div class="hbar"><i style="width:' + k.tiLe + '%;background:' + color(k.tiLe) + '"></i></div></div>'; }).join('') + '</div>' : '') + '</div></div>' +
    '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Từng câu theo mã đề</h3><span class="small muted">' + t.coChiTiet + ' bài có chi tiết câu trả lời</span></div><div id="sMaBody">' + drawMa() + '</div></div>' +
    '<div class="grid grid-2"><div class="panel"><div class="panel-head"><h3>Cần bổ túc (' + t.boTuc.length + ' em)</h3><span class="small muted">dưới ' + fmtScore(t.nguong) + ' điểm, hoặc một phần dưới một nửa</span></div>' +
    (t.boTuc.length ? '<div class="table-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th>SBD</th><th>Họ tên</th><th class="r">Điểm</th><th>Lý do</th></tr></thead><tbody>' +
      t.boTuc.map(function (b2) { return '<tr><td class="sbd">' + esc(b2.sbd) + '</td><td>' + esc(b2.ten) + '</td><td class="r num"><b>' + fmtScore(b2.tong) + '</b></td><td class="small">' + b2.lyDo.map(esc).join(', ') + '</td></tr>'; }).join('') + '</tbody></table></div>' : emptyState('okc', 'Không em nào cần bổ túc', '')) + '</div>' +
    '<div class="panel"><div class="panel-head"><h3>So với các bài trước</h3><span class="small muted">điểm trung bình theo nhóm</span></div>' + trend() + '</div></div></div>');
  $$('.kpi .v[data-c]', v).forEach(function (el) { countUp(el, Number(el.dataset.c), 900); });
  var bindMa = function () { $$('#sMa button').forEach(function (bt) { bt.onclick = function () { state.ma = bt.dataset.m; $('#sMaBody').innerHTML = drawMa(); bindMa(); }; }); };
  bindMa();
  $('#sNhom').onchange = function () { var g = nh.find(function (x) { return x.maNhom === this.value; }, this); $('#sHist').innerHTML = hist(g ? g.pho : TQ.pho); };
}

window.registerDiemRoutes = function () {
  Router.on('/bai/:id/nhap-diem', screenReconcile, { nav: 'bai' });
  Router.on('/bai/:id/ket-qua', screenResults, { nav: 'bai' });
  Router.on('/bai/:id/ket-qua/:tab', screenResults, { nav: 'bai' });
  Router.on('/bai/:id/thong-ke', screenStats, { nav: 'bai' });
};
