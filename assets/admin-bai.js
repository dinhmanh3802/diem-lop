/* SỔ ĐIỂM — bài kiểm tra: danh sách, cấu hình, trang bài, nhập đáp án, tải PDF thành ảnh */
'use strict';
/* >>> UPLOAD-QUEUE */
async function uploadWithRetry(uploadFn, item, data, state){
  const tries = state.tries || 3;
  const back = state.backoffMs == null ? 800 : state.backoffMs;
  for(let t=0; t<tries; t++){
    if(state.cancel) return false;
    try{ await uploadFn(item, data); return true; }
    catch(e){
      const msg = (e && e.message) || String(e);
      state.lastError = msg;
      if(/Phiên đã hết hạn/.test(msg)){ state.authLost = true; state.cancel = true; return false; }
      if(t === tries-1) return false;
      await sleep(back*(t+1));
    }
  }
  return false;
}
async function runUploadQueue(items, renderFn, uploadFn, state){
  const conc = state.concurrency || 3;
  const prog = ()=>{ try{ if(state.onProgress) state.onProgress(); }catch(e){} };
  const active = new Set();
  for(const item of items){
    if(state.cancel) break;
    while(active.size >= conc) await Promise.race(active);
    if(state.cancel) break;
    let data;
    try{ data = await renderFn(item); }
    catch(e){ state.failed.push({item, data:null}); state.lastError = 'Không vẽ được trang '+item.name; prog(); continue; }
    const pr = uploadWithRetry(uploadFn, item, data, state).then(ok=>{
      if(ok) state.done++; else state.failed.push({item, data});
      active.delete(pr);
      prog();
    });
    active.add(pr);
  }
  await Promise.all(Array.from(active));
}
/* <<< UPLOAD-QUEUE */

async function renderPreview(canvas, doc, extra, width){
  const page = await doc.getPage(1);
  const rot = (((page.rotate + extra) % 360) + 360) % 360;
  const base = page.getViewport({scale:1, rotation:rot});
  const vp = page.getViewport({scale:(width||260)/base.width, rotation:rot});
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
}

// Vẽ một trang ra ảnh JPEG ~200 dpi (đúng độ phân giải bản quét gốc), trả về base64
async function pageToJpegBase64(doc, pageNum, extra){
  const page = await doc.getPage(pageNum);
  const rot = (((page.rotate + extra) % 360) + 360) % 360;
  const base = page.getViewport({scale:1, rotation:rot});
  let scale = 200/72;
  const maxPx = 5.5e6;                                   // khổ lớn quá thì hạ bớt, tránh tràn bộ nhớ
  if(base.width*base.height*scale*scale > maxPx) scale = Math.sqrt(maxPx/(base.width*base.height));
  const vp = page.getViewport({scale, rotation:rot});
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
  const b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  canvas.width = canvas.height = 0;
  page.cleanup();
  return b64;
}


/* =====================================================================
   BÀI KIỂM TRA: danh sách, tạo/sửa, trang bài, nhập đáp án, tải PDF
   ===================================================================== */
function normMaDeC(v) { var s = String(v || '').replace(/\D/g, ''); return s ? ('00' + parseInt(s, 10)).slice(-3) : ''; }
function cfgTotal(c) {
  var t = 0;
  if (c.p1 && c.p1.on) t += Number(c.p1.diem) || 0;
  if (c.p2 && c.p2.on) t += (Number(c.p2.soCau) || 0) * (Number(c.p2.d4) || 0);
  if (c.p3 && c.p3.on) t += Number(c.p3.diem) || 0;
  return Math.round(t * 100) / 100;
}
function blankCfg() { return { p1: { on: true, soCau: 18, diem: 4.5 }, p2: { on: true, soCau: 4, d1: 0.1, d2: 0.25, d3: 0.5, d4: 1 }, p3: { on: true, soCau: 6, diem: 1.5 }, maDeList: [] }; }
function findBaiLocal(id) { return App.state.bai.find(function (b) { return String(b.maBai) === String(id); }); }

/* ---------------- danh sách bài ---------------- */
async function screenBaiList() {
  var v = V(), filter = sessionStorage.getItem('sd_baif') || 'dang', q = '';
  var draw = function () {
    var all = App.state.bai;
    var groups = { dang: all.filter(function (b) { return !b.luuTru && b.trangThai !== 'Đã công bố'; }), cong: all.filter(function (b) { return !b.luuTru && b.trangThai === 'Đã công bố'; }), luu: all.filter(function (b) { return b.luuTru; }) };
    var list = (groups[filter] || []).filter(function (b) { return !q || (b.tenBai + ' ' + b.cacNhom.join(' ') + ' ' + (b.teacher || '')).toLowerCase().indexOf(q) !== -1; });
    var html = '<div class="page"><div class="page-head"><div class="titles"><h1>Bài kiểm tra</h1><div class="sub">Mỗi bài: đáp án, ảnh phiếu, điểm, công bố. Làm phần nào trước cũng được.</div></div>' +
      (isAdmin() ? '' : '<a class="btn btn-primary" href="#/bai/moi">' + icon('plus') + '<span>Tạo bài mới</span></a>') + '</div>' +
      '<div class="row" style="margin-bottom:14px"><div class="seg" id="bseg"><button data-f="dang" class="' + (filter === 'dang' ? 'active' : '') + '">Đang làm<span class="n">' + groups.dang.length + '</span></button>' +
      '<button data-f="cong" class="' + (filter === 'cong' ? 'active' : '') + '">Đã công bố<span class="n">' + groups.cong.length + '</span></button>' +
      '<button data-f="luu" class="' + (filter === 'luu' ? 'active' : '') + '">Lưu trữ<span class="n">' + groups.luu.length + '</span></button></div>' +
      '<div class="grow"></div><input class="input input-sm" id="bq" placeholder="Tìm tên bài, nhóm" value="' + esc(q) + '" style="max-width:240px"></div>' +
      '<div class="panel" style="padding:0;overflow:hidden">' + (list.length ? '<div class="list">' + list.map(baiItemHtml).join('') + '</div>' :
        emptyState('sheet', filter === 'luu' ? 'Không có bài lưu trữ' : q ? 'Không tìm thấy' : 'Chưa có bài', filter === 'dang' && !q ? 'Tạo bài, rồi nhập đáp án, tải ảnh phiếu hoặc nhập điểm.' : '',
          filter === 'dang' && !q && !isAdmin() ? '<a class="btn btn-primary" href="#/bai/moi">' + icon('plus') + '<span>Tạo bài mới</span></a>' : '')) + '</div></div>';
    swap(v, html);
    $$('#bseg button').forEach(function (b) { b.onclick = function () { filter = b.dataset.f; sessionStorage.setItem('sd_baif', filter); draw(); }; });
    var inp = $('#bq');
    inp.oninput = debounce(function () { q = inp.value.trim().toLowerCase(); draw(); var x = $('#bq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 180);
  };
  draw();
  Api.swr('listBai', {}, function (d) { App.state.bai = d.bai; draw(); }).catch(toastErr);
}

/* ---------------- tạo / sửa bài ---------------- */
async function screenBaiConfig(params) {
  var v = V(), bai = null;
  if (params.id) {
    swap(v, skPage());
    try { bai = await Api.call('getBai', { maBai: params.id }); } catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không mở được bài', e.message) + '</div>'); return; }
  }
  var cfg = bai ? JSON.parse(JSON.stringify(bai.cauHinh)) : blankCfg();
  var maList = (cfg.maDeList || []).map(normMaDeC);
  var chosen = {}; (bai ? bai.cacNhom : []).forEach(function (m) { chosen[m] = true; });
  var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  var part = function (k, title, body) {
    var on = cfg[k].on;
    return '<div class="panel stack" data-part="' + k + '"><div class="row"><h3 class="grow">' + title + '</h3><label class="switch"><input type="checkbox" class="pOn" ' + (on ? 'checked' : '') + '><span class="track"></span><span class="small">Có phần này</span></label></div>' +
      '<div class="pBody ' + (on ? '' : 'hidden') + '">' + body + '</div></div>';
  };
  var num = function (id, label, val, step, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" type="number" inputmode="decimal" id="' + id + '" value="' + esc(val) + '" step="' + (step || 1) + '" min="0">' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; };
  swap(v, '<div class="page"><a class="back" href="' + (bai ? '#/bai/' + esc(bai.maBai) : '#/bai') + '">' + icon('chevL') + (bai ? esc(bai.tenBai) : 'Bài kiểm tra') + '</a>' +
    '<div class="page-head"><div class="titles"><h1>' + (bai ? 'Sửa cấu hình bài' : 'Tạo bài mới') + '</h1><div class="sub">Phiếu theo mẫu Bộ GD 2025: Phần I chọn A–D, Phần II đúng/sai, Phần III trả lời ngắn.</div></div></div>' +
    '<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start" id="cfgGrid">' +
    '<div class="stack">' +
    '<div class="panel stack"><h3>Thông tin bài</h3><div class="grid grid-2">' +
    '<div class="field" style="grid-column:1/-1"><label for="cTen">Tên bài</label><input class="input" id="cTen" value="' + esc(bai ? bai.tenBai : '') + '" placeholder="vd: Kiểm tra 15 phút chương 1"></div>' +
    '<div class="field"><label for="cNgay">Ngày kiểm tra</label><input class="input" type="date" id="cNgay" value="' + esc(bai ? bai.ngay : today) + '"></div>' +
    '<div class="field"><label>Mã đề</label><div class="tagbox" id="cMa"><input id="cMaIn" inputmode="numeric" placeholder="gõ mã rồi Enter"></div><div class="hint">vd: 5, 6, 7, 8 (tự thành 005…)</div></div></div>' +
    '<div class="field"><label>Nhóm làm bài</label><div class="chips">' + (App.state.groups.length ? App.state.groups.map(function (g) {
      return '<label class="chip"><input type="checkbox" class="cNhom" value="' + esc(g.maNhom) + '" ' + (chosen[g.maNhom] ? 'checked' : '') + '><span class="bubble"></span>' + esc(g.tenNhom) + ' <span class="muted small">' + g.maNhom + '</span></label>';
    }).join('') : '<span class="muted small">Chưa có nhóm. Vào "Lớp và học sinh" bấm "Đồng bộ nhóm".</span>') + '</div></div></div>' +
    part('p1', 'Phần I: trắc nghiệm A, B, C, D', '<div class="grid grid-2">' + num('p1n', 'Số câu', cfg.p1.soCau) + num('p1d', 'Tổng điểm phần', cfg.p1.diem, 0.05, 'Mỗi câu = tổng ÷ số câu') + '</div>') +
    part('p2', 'Phần II: đúng hoặc sai (4 ý mỗi câu)', '<div class="grid grid-2">' + num('p2n', 'Số câu', cfg.p2.soCau) + '<div></div>' +
      num('p2d1', 'Đúng 1 ý', cfg.p2.d1, 0.05) + num('p2d2', 'Đúng 2 ý', cfg.p2.d2, 0.05) + num('p2d3', 'Đúng 3 ý', cfg.p2.d3, 0.05) + num('p2d4', 'Đúng cả 4 ý', cfg.p2.d4, 0.05) + '</div>') +
    part('p3', 'Phần III: trả lời ngắn', '<div class="grid grid-2">' + num('p3n', 'Số câu', cfg.p3.soCau) + num('p3d', 'Tổng điểm phần', cfg.p3.diem, 0.05) + '</div>') +
    '</div>' +
    '<div class="panel stack" style="position:sticky;top:20px"><div class="meter" id="cMeter"><div class="ring"></div><div><div class="v num" id="cTot">0</div><div class="small muted">tổng điểm, cần đúng 10</div></div></div>' +
    '<div id="cSum" class="small muted"></div>' +
    '<button class="btn btn-primary btn-lg" id="cSave">' + icon('check') + '<span>' + (bai ? 'Lưu cấu hình' : 'Tạo bài') + '</span></button>' +
    '<p class="small muted">Đáp án, ảnh phiếu và điểm làm ở trang bài, không bắt buộc theo thứ tự.</p></div></div></div>');
  if (window.matchMedia && window.matchMedia('(max-width: 860px)').matches) $('#cfgGrid').style.gridTemplateColumns = '1fr';
  // ô nhập mã đề dạng thẻ
  var box = $('#cMa'), inp = $('#cMaIn');
  var drawTags = function () {
    $$('.tag', box).forEach(function (t) { t.remove(); });
    maList.forEach(function (m, i) {
      var t = document.createElement('span'); t.className = 'tag'; t.innerHTML = esc(m) + '<button type="button" aria-label="Bỏ mã ' + esc(m) + '">' + icon('x') + '</button>';
      t.querySelector('svg').style.width = '14px'; t.querySelector('svg').style.height = '14px';
      t.querySelector('button').onclick = function () { maList.splice(i, 1); drawTags(); recalc(); };
      box.insertBefore(t, inp);
    });
  };
  var addMa = function () {
    inp.value.split(/[,;\s]+/).forEach(function (x) { var m = normMaDeC(x); if (m && maList.indexOf(m) === -1) maList.push(m); });
    maList.sort(); inp.value = ''; drawTags(); recalc();
  };
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addMa(); }
    else if (e.key === 'Backspace' && !inp.value && maList.length) { maList.pop(); drawTags(); recalc(); }
  });
  inp.addEventListener('blur', function () { if (inp.value.trim()) addMa(); });
  box.onclick = function () { inp.focus(); };
  var read = function () {
    var n = function (id) { var x = $('#' + id); return x ? Number(x.value) : 0; };
    var on = function (k) { return $('[data-part="' + k + '"] .pOn').checked; };
    return { p1: { on: on('p1'), soCau: n('p1n'), diem: n('p1d') }, p2: { on: on('p2'), soCau: n('p2n'), d1: n('p2d1'), d2: n('p2d2'), d3: n('p2d3'), d4: n('p2d4') }, p3: { on: on('p3'), soCau: n('p3n'), diem: n('p3d') }, maDeList: maList.slice() };
  };
  var recalc = function () {
    var c = read(), t = cfgTotal(c), m = $('#cMeter');
    $('#cTot').textContent = fmtScore(t);
    m.querySelector('.ring').style.setProperty('--p', Math.min(100, t * 10));
    m.classList.toggle('full', Math.abs(t - 10) < 0.001); m.classList.toggle('over', t > 10.001);
    var parts = [];
    if (c.p1.on) parts.push('Phần I: ' + c.p1.soCau + ' câu, ' + fmtScore(c.p1.soCau ? c.p1.diem / c.p1.soCau : 0) + ' điểm/câu');
    if (c.p2.on) parts.push('Phần II: ' + c.p2.soCau + ' câu, tối đa ' + fmtScore(c.p2.soCau * c.p2.d4));
    if (c.p3.on) parts.push('Phần III: ' + c.p3.soCau + ' câu, ' + fmtScore(c.p3.soCau ? c.p3.diem / c.p3.soCau : 0) + ' điểm/câu');
    $('#cSum').innerHTML = parts.map(esc).join('<br>') + '<br>' + (maList.length ? maList.length + ' mã đề' : '<span style="color:var(--red)">Chưa có mã đề</span>');
  };
  $$('[data-part] .pOn').forEach(function (x) { x.onchange = function () { x.closest('[data-part]').querySelector('.pBody').classList.toggle('hidden', !x.checked); recalc(); }; });
  $$('#view input[type=number]').forEach(function (x) { x.addEventListener('input', recalc); });
  drawTags(); recalc();
  $('#cSave').onclick = function () {
    if (inp.value.trim()) addMa();
    var c = read(), ten = $('#cTen').value.trim(), nhom = $$('.cNhom:checked').map(function (x) { return x.value; });
    if (!ten) { $('#cTen').classList.add('is-bad'); $('#cTen').focus(); toast('Nhập tên bài', 'error'); return; }
    if (Math.abs(cfgTotal(c) - 10) > 0.001) { toast('Tổng điểm đang là ' + fmtScore(cfgTotal(c)) + ', cần đúng 10', 'error'); return; }
    if (!c.maDeList.length) { inp.focus(); toast('Nhập ít nhất một mã đề', 'error'); return; }
    if (!nhom.length && !bai) { toast('Chọn ít nhất một nhóm làm bài', 'error'); return; }
    busy(this, async function () {
      var id;
      if (bai) { await Api.call('updateBai', { maBai: bai.maBai, tenBai: ten, ngay: $('#cNgay').value, cacNhom: nhom, cauHinh: c }); id = bai.maBai; }
      else id = (await Api.call('createBai', { tenBai: ten, ngay: $('#cNgay').value, cacNhom: nhom, cauHinh: c })).maBai;
      Api.invalidate('listBai');
      toast(bai ? 'Đã lưu cấu hình' : 'Đã tạo bài', 'success');
      Router.go('/bai/' + id);
    });
  };
}

/* ---------------- trang một bài ---------------- */
function keyFilled(cfg, k) {
  var n = 0, need = 0, i;
  k = k || {};
  if (cfg.p1 && cfg.p1.on) for (i = 0; i < cfg.p1.soCau; i++) { need++; if (/^[A-D]$/.test((k.p1 || [])[i] || '')) n++; }
  if (cfg.p2 && cfg.p2.on) for (i = 0; i < cfg.p2.soCau; i++) { need++; if (/^[ĐS]{4}$/.test((k.p2 || [])[i] || '')) n++; }
  if (cfg.p3 && cfg.p3.on) for (i = 0; i < cfg.p3.soCau; i++) { need++; if (String((k.p3 || [])[i] || '').trim()) n++; }
  return { n: n, need: need, done: need > 0 && n === need };
}

async function screenBaiHub(params) {
  var v = V(), id = params.id, local = findBaiLocal(id);
  if (local) swap(v, '<div class="page"><a class="back" href="#/bai">' + icon('chevL') + 'Bài kiểm tra</a><div class="page-head"><div class="titles"><h1>' + esc(local.tenBai) + '</h1><div class="sub">Đang tải…</div></div></div><div class="grid grid-2"><div class="sk sk-block"></div><div class="sk sk-block"></div><div class="sk sk-block"></div><div class="sk sk-block"></div></div></div>');
  else swap(v, skPage());
  try { await Api.swr('getBaiFull', { maBai: id }, function (data) { if (Router.cur === '/bai/' + id) renderHub(data); }); }
  catch (e) { swap(v, '<div class="page"><a class="back" href="#/bai">' + icon('chevL') + 'Bài kiểm tra</a>' + emptyState('alert', 'Không mở được bài', e.message) + '</div>'); return; }
  function renderHub(b) {
  App.cur = { bai: b };
  var cfg = b.cauHinh, mas = cfg.maDeList || [];
  var fill = mas.map(function (m) { return keyFilled(cfg, b.dapAn[m]); }), doneMa = fill.filter(function (f) { return f.done; }).length;
  var keysOk = mas.length && doneMa === mas.length;
  var pub = b.trangThai === 'Đã công bố', anh = b.anh || { count: 0 };
  var step = function (cls, label, sub) { return '<div class="step ' + cls + '"><span class="bubble">' + (cls.indexOf('done') !== -1 ? icon('check') : '') + '</span><div>' + label + '<div class="small muted" style="font-weight:400">' + sub + '</div></div></div>'; };
  swap(v, '<div class="page"><a class="back" href="#/bai">' + icon('chevL') + 'Bài kiểm tra</a>' +
    '<div class="page-head"><div class="titles"><h1>' + esc(b.tenBai) + ' ' + trangThaiBadge({ luuTru: b.luuTru, trangThai: b.trangThai, soKetQua: b.soKetQua }) + '</h1>' +
    kv([['Ngày kiểm tra', fmtDate(b.ngay)], ['Nhóm', b.cacNhom.length ? b.cacNhom.join(', ') : 'chưa chọn'], ['Số mã đề', mas.length], isAdmin() ? ['Giáo viên', b.teacher] : null]) + '</div>' +
    '<div class="menu"><button class="btn" id="hMore">' + icon('more') + '<span>Thêm</span></button></div></div>' +
    '<div class="steps">' +
    step(keysOk || b.dapAnFile ? 'done' : (doneMa ? 'now' : ''), 'Đáp án', b.dapAnFile ? 'đã có file' : doneMa + '/' + mas.length + ' mã đủ') +
    step(anh.count ? 'done' : '', 'Ảnh phiếu', anh.count ? anh.count + ' ảnh' : 'không bắt buộc') +
    step(b.soKetQua ? (b.soChoXuLy ? 'done warn' : 'done') : '', 'Điểm', b.soKetQua ? b.soKetQua + ' em' + (b.soChoXuLy ? ', ' + b.soChoXuLy + ' chờ' : '') : 'chưa nhập') +
    step(pub ? 'done' : (b.soKetQua ? 'now' : ''), 'Công bố', pub ? 'học sinh tra được' : 'chưa') + '</div>' +
    '<div class="grid grid-2 stagger">' +
    '<div class="panel stack"><div class="row"><h3 class="grow">Đáp án</h3>' + (keysOk ? '<span class="badge ok">Đủ</span>' : '') + '</div>' +
    '<p class="muted small">' + (mas.length ? mas.map(function (m, i) { return '<b>' + esc(m) + '</b> ' + fill[i].n + '/' + fill[i].need; }).join(', ') : 'Chưa có mã đề') + '</p>' +
    '<div class="row"><a class="btn ' + (keysOk ? '' : 'btn-primary') + '" href="#/bai/' + esc(id) + '/dap-an">' + icon('pen') + '<span>' + (doneMa ? 'Sửa đáp án' : 'Nhập đáp án') + '</span></a>' +
    (keysOk ? '<button class="btn btn-primary" id="hGen">' + icon('file') + '<span>Tạo file cho TNMaker</span></button>' : '') + '</div>' +
    (b.dapAnFile ? '<div class="row small"><a href="' + esc(b.dapAnFile.downloadUrl) + '">' + icon('download', '') + '</a><a href="' + esc(b.dapAnFile.downloadUrl) + '">Tải file đáp án</a><span class="muted">·</span><a href="' + esc(b.dapAnFile.url) + '" target="_blank">Mở trên Drive</a></div>' : '') +
    '<p class="small muted">Có sẵn file đáp án thì không cần nhập: điểm vẫn nhập được bình thường.</p></div>' +
    '<div class="panel stack" id="dropPdf"><div class="row"><h3 class="grow">Ảnh phiếu bài làm</h3>' + (anh.count ? '<span class="badge ok">' + anh.count + ' ảnh</span>' : '') + '</div>' +
    '<p class="muted small">Chọn một hoặc nhiều file PDF (mỗi lớp một file), hoặc kéo thả vào khung này. Mỗi trang thành một ảnh đứng thẳng cho TNMaker.</p>' +
    '<div class="row"><button class="btn btn-primary" id="hPdf">' + icon('upload') + '<span>Chọn file PDF</span></button><input type="file" id="hPdfIn" accept="application/pdf,.pdf" multiple class="hidden">' +
    (anh.folderUrl ? '<a class="btn btn-ghost" href="' + esc(anh.folderUrl) + '" target="_blank">' + icon('image') + '<span>Mở thư mục ảnh</span></a>' : '') + '</div>' +
    (anh.loi ? '<div class="note red">' + icon('alert') + '<div>' + esc(anh.loi) + '</div></div>' : '') + '</div>' +
    '<div class="panel stack"><div class="row"><h3 class="grow">Điểm</h3>' + (b.soChoXuLy ? '<span class="badge warn">' + b.soChoXuLy + ' dòng chờ</span>' : '') + '</div>' +
    '<p class="muted small">' + (b.soKetQua ? 'Đã có ' + b.soKetQua + ' kết quả.' : 'Chấm bằng TNMaker rồi chọn file điểm (.xls). Web tự đối chiếu với danh sách lớp, báo SBD lỗi trước khi ghi.') + '</p>' +
    '<div class="row"><button class="btn ' + (b.soKetQua ? '' : 'btn-primary') + '" id="hScore">' + icon('upload') + '<span>Nhập file điểm</span></button><input type="file" id="hScoreIn" accept=".xls,.xlsx,.csv" class="hidden">' +
    ((b.soKetQua || b.soChoXuLy) ? '<a class="btn btn-primary" href="#/bai/' + esc(id) + '/ket-qua' + (b.soChoXuLy && !b.soKetQua ? '/cho' : '') + '">' + icon('sheet') + '<span>Xem kết quả</span></a>' : '') +
    (b.soKetQua ? '<a class="btn" href="#/bai/' + esc(id) + '/thong-ke">' + icon('chart') + '<span>Thống kê</span></a>' : '') + '</div></div>' +
    '<div class="panel stack"><div class="row"><h3 class="grow">Công bố</h3>' + (pub ? '<span class="badge ok">Đang công bố</span>' : '') + '</div>' +
    '<p class="muted small">' + (pub ? 'Học sinh nhập SBD ở trang tra điểm là xem được điểm và từng câu sai. Ảnh phiếu tự xóa sau ' + (App.state.caiDat.soNgayGiuAnh || 30) + ' ngày.' : 'Công bố xong học sinh mới tra được điểm bài này.') + '</p>' +
    '<div class="row"><button class="btn ' + (pub ? '' : 'btn-primary') + '" id="hPub" ' + (b.soKetQua ? '' : 'disabled') + '>' + icon(pub ? 'eyeOff' : 'eye') + '<span>' + (pub ? 'Ẩn điểm' : 'Công bố điểm') + '</span></button>' +
    '<a class="btn btn-ghost" href="index.html" target="_blank">' + icon('link') + '<span>Trang tra điểm</span></a></div></div>' +
    '</div></div>');
  $('#hMore').onclick = function (e) {
    e.stopPropagation();
    popMenu(this, [
      { label: 'Sửa cấu hình bài', icon: 'pen', onClick: function () { Router.go('/bai/' + id + '/sua'); } },
      { label: b.luuTru ? 'Bỏ lưu trữ' : 'Lưu trữ (ẩn khỏi danh sách)', icon: 'archive', onClick: function () {
        busy(null, async function () { await Api.call('luuTruBai', { maBai: id, luuTru: !b.luuTru }); Api.invalidate('listBai'); screenBaiHub(params); }, { ok: b.luuTru ? 'Đã bỏ lưu trữ' : 'Đã lưu trữ bài' });
      } },
      '-',
      { label: 'Xóa hẳn bài này', icon: 'trash', danger: true, onClick: async function () {
        var ok = await Modal.confirm({ title: 'Xóa hẳn bài?', danger: true, confirmText: 'Xóa hẳn', typeToConfirm: b.tenBai,
          html: 'Xóa toàn bộ điểm, dòng chờ, đáp án của <b>' + esc(b.tenBai) + '</b>; thư mục ảnh trên Drive vào thùng rác. <b>Không hoàn tác được.</b> Chỉ muốn ẩn đi thì chọn "Lưu trữ".' });
        if (!ok) return;
        busy(null, async function () { await Api.call('xoaBai', { maBai: id, xacNhan: b.tenBai }); Api.invalidate('listBai'); App.state.bai = App.state.bai.filter(function (x) { return x.maBai !== id; }); Router.go('/bai'); }, { ok: 'Đã xóa bài' });
      } }
    ]);
  };
  if ($('#hGen')) $('#hGen').onclick = function () { genFile(this, b); };
  $('#hPdf').onclick = function () { $('#hPdfIn').click(); };
  $('#hPdfIn').onchange = function (e) { var arr = Array.from(e.target.files || []); e.target.value = ''; if (arr.length) openPdfWizard(arr, id, anh.count); };
  var dz = $('#dropPdf');
  ['dragenter', 'dragover'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.style.outline = '2px dashed var(--blue)'; }); });
  ['dragleave', 'drop'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.style.outline = ''; }); });
  dz.addEventListener('drop', function (e) { var arr = Array.from((e.dataTransfer && e.dataTransfer.files) || []); if (arr.length) openPdfWizard(arr, id, anh.count); });
  $('#hScore').onclick = function () { $('#hScoreIn').click(); };
  $('#hScoreIn').onchange = function (e) { var f = (e.target.files || [])[0]; e.target.value = ''; if (f && window.openScoreImport) window.openScoreImport(f, b); };
  $('#hPub').onclick = function () { togglePublishBai(this, b, function () { screenBaiHub(params); }); };
  }
}

async function togglePublishBai(btn, b, after) {
  var pub = b.trangThai === 'Đã công bố';
  if (!pub) {
    var ok = await Modal.confirm({ title: 'Công bố điểm?', confirmText: 'Công bố',
      html: 'Học sinh nhập SBD ở trang tra điểm sẽ xem được điểm và từng câu sai của bài <b>' + esc(b.tenBai) + '</b>. Ảnh phiếu tự xóa sau ' + (App.state.caiDat.soNgayGiuAnh || 30) + ' ngày.' + (b.soChoXuLy ? '<br><br><b style="color:var(--amber)">Còn ' + b.soChoXuLy + ' dòng điểm chờ xử lý</b>: các em đó chưa tra được cho tới khi gán xong.' : '') });
    if (!ok) return;
  }
  busy(btn, async function () {
    var r = await Api.call('setCongBo', { maBai: b.maBai, congBo: !pub });
    b.trangThai = r.trangThai; Api.invalidate('listBai');
    after && after();
  }, { ok: pub ? 'Đã ẩn điểm' : 'Đã công bố điểm' });
}

async function genFile(btn, b) {
  await busy(btn, async function () {
    var r = await Api.call('genDapAnFile', { maBai: b.maBai }, { timeout: 90000 });
    Modal.open({ title: 'Đã tạo file đáp án', body: '<div class="note green">' + icon('okc') + '<div>File <b>' + esc(r.name) + '</b> đã lưu vào thư mục của bài trên Drive. Tải về rồi nhập vào TNMaker.</div></div>',
      actions: [{ label: 'Mở trên Drive', kind: '', onClick: function (c) { window.open(r.url, '_blank'); c.close(); } }, { label: 'Tải về', kind: 'btn-primary', icon: 'download', onClick: function (c) { location.href = r.downloadUrl; c.close(); } }] });
  });
}

/* ---------------- nhập đáp án kiểu tô phiếu, tự lưu ---------------- */
async function screenAnswers(params) {
  var v = V(), id = params.id;
  swap(v, skPage());
  var b;
  try { b = await Api.call('getBai', { maBai: id }); } catch (e) { swap(v, '<div class="page">' + emptyState('alert', 'Không mở được bài', e.message) + '</div>'); return; }
  var cfg = b.cauHinh, mas = (cfg.maDeList || []).slice();
  if (!mas.length) { swap(v, '<div class="page"><a class="back" href="#/bai/' + esc(id) + '">' + icon('chevL') + esc(b.tenBai) + '</a>' + emptyState('sheet', 'Chưa có mã đề', 'Thêm mã đề trong phần cấu hình bài.', '<a class="btn btn-primary" href="#/bai/' + esc(id) + '/sua">Sửa cấu hình</a>') + '</div>'); return; }
  var ans = {}, dirty = {}, saving = false, lastSaved = null, saveErr = '';
  var norm = function (k) {
    k = k || {};
    return { p1: Array.from({ length: cfg.p1.on ? cfg.p1.soCau : 0 }, function (_, i) { return /^[A-D]$/.test((k.p1 || [])[i] || '') ? k.p1[i] : ''; }),
      p2: Array.from({ length: cfg.p2.on ? cfg.p2.soCau : 0 }, function (_, i) { var s = String((k.p2 || [])[i] || ''); return (s + '____').slice(0, 4).replace(/[^ĐS]/g, '_'); }),
      p3: Array.from({ length: cfg.p3.on ? cfg.p3.soCau : 0 }, function (_, i) { return String((k.p3 || [])[i] || ''); }) };
  };
  mas.forEach(function (m) { ans[m] = norm(b.dapAn[m]); });
  // bản nháp trên máy (khi mất mạng hoặc lỡ tải lại trang)
  var DK = 'sd_draft_' + id;
  try {
    var dr = JSON.parse(localStorage.getItem(DK) || 'null');
    if (dr && dr.ans && JSON.stringify(dr.ans) !== JSON.stringify(ans)) {
      var restore = await Modal.confirm({ title: 'Có bản nháp chưa lưu', html: 'Máy này còn đáp án nhập lúc ' + esc(new Date(dr.t).toLocaleString('vi-VN')) + ' mà chưa lưu lên hệ thống. Dùng lại bản nháp đó?', confirmText: 'Dùng bản nháp', cancelText: 'Bỏ bản nháp' });
      if (restore) { mas.forEach(function (m) { if (dr.ans[m]) { ans[m] = norm(dr.ans[m]); dirty[m] = true; } }); }
      else localStorage.removeItem(DK);
    }
  } catch (e) {}
  var cur = mas[0];
  var saveDraft = function () { try { localStorage.setItem(DK, JSON.stringify({ t: Date.now(), ans: ans })); } catch (e) {} };
  var setState = function () {
    var el = $('#svState'); if (!el) return;
    var nDirty = Object.keys(dirty).length;
    if (saving) el.className = 'save-state', el.innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px"></span>Đang lưu…';
    else if (saveErr) el.className = 'save-state bad', el.innerHTML = icon('alert') + 'Chưa lưu được. <a href="javascript:void 0" id="svRetry">Thử lại</a>';
    else if (nDirty) el.className = 'save-state', el.innerHTML = icon('clock') + 'Chưa lưu';
    else if (lastSaved) el.className = 'save-state ok', el.innerHTML = icon('check') + 'Đã lưu lúc ' + lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    else el.className = 'save-state', el.innerHTML = '';
    var r = $('#svRetry'); if (r) r.onclick = function () { flush(); };
  };
  var flush = async function () {
    if (saving) return;
    var ks = Object.keys(dirty);
    if (!ks.length) return;
    saving = true; saveErr = ''; setState();
    try {
      for (var i = 0; i < ks.length; i++) {
        var m = ks[i], snap = JSON.stringify(ans[m]), d = {}; d[m] = ans[m];
        await Api.call('saveDapAn', { maBai: id, maDe: m, dapAn: d }, { silent: true, retry: 2 });
        if (JSON.stringify(ans[m]) === snap) delete dirty[m];
      }
      lastSaved = new Date();
      if (!Object.keys(dirty).length) { try { localStorage.removeItem(DK); } catch (e) {} }
    } catch (e) { saveErr = e.message; }
    saving = false; setState(); drawTabs();
    if (Object.keys(dirty).length && !saveErr) autosave();
  };
  var autosave = debounce(flush, 1200);
  var changed = function () { dirty[cur] = true; saveDraft(); setState(); drawTabs(); autosave(); };
  Router.guard = async function () {
    if (!Object.keys(dirty).length && !saving) return true;
    await flush();
    if (!Object.keys(dirty).length) return true;
    return Modal.confirm({ title: 'Đáp án chưa lưu được', message: 'Rời đi bây giờ thì bản nháp vẫn được giữ trên máy này, lần sau mở lại sẽ hỏi dùng lại. Vẫn rời đi?', confirmText: 'Rời đi', danger: true });
  };
  window.onbeforeunload = function () { return Object.keys(dirty).length ? 'unsaved' : undefined; };

  swap(v, '<div class="page"><a class="back" href="#/bai/' + esc(id) + '">' + icon('chevL') + esc(b.tenBai) + '</a>' +
    '<div class="page-head"><div class="titles"><h1>Nhập đáp án</h1><div class="sub">Bấm vào ô tròn, hoặc gõ phím <span class="kbd">A</span> <span class="kbd">B</span> <span class="kbd">C</span> <span class="kbd">D</span> (Phần II: <span class="kbd">Đ</span> hoặc <span class="kbd">D</span>, <span class="kbd">S</span>). Web tự nhảy sang câu sau và tự lưu.</div></div>' +
    '<div class="row"><span id="svState" class="save-state"></span><button class="btn" id="aPaste">' + icon('copy') + '<span>Dán nhanh</span></button><button class="btn btn-primary" id="aGen">' + icon('file') + '<span>Tạo file cho TNMaker</span></button></div></div>' +
    '<div class="panel"><div class="ma-tabs" id="aTabs"></div></div><div id="aBody"></div></div>');
  var drawTabs = function () {
    var box = $('#aTabs'); if (!box) return;
    box.innerHTML = mas.map(function (m) {
      var f = keyFilled(cfg, ans[m]);
      return '<button class="ma-tab ' + (m === cur ? 'active' : '') + '" data-m="' + esc(m) + '"><span class="ring" style="--p:' + (f.need ? Math.round(f.n * 100 / f.need) : 0) + '"></span>Mã ' + esc(m) + '<span class="small" style="opacity:.75;font-weight:500">' + f.n + '/' + f.need + '</span>' + (dirty[m] ? '<span title="Chưa lưu" style="width:6px;height:6px;border-radius:50%;background:var(--amber)"></span>' : '') + '</button>';
    }).join('');
    $$('.ma-tab', box).forEach(function (t) { t.onclick = function () { cur = t.dataset.m; drawTabs(); drawBody(); }; });
  };
  var focusQ = function (sel) { var el = $(sel); if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); } };
  var drawBody = function () {
    var a = ans[cur], h = '';
    if (cfg.p1.on) h += '<div class="panel"><div class="panel-head"><h3>Phần I</h3><span class="small muted">' + a.p1.filter(Boolean).length + '/' + a.p1.length + '</span></div><div class="ans-grid">' + a.p1.map(function (x, i) {
      return '<div class="q" tabindex="0" data-p="1" data-i="' + i + '"><span class="n">' + (i + 1) + '</span>' + ['A', 'B', 'C', 'D'].map(function (o) { return '<span class="bubble ' + (x === o ? 'on' : '') + '" data-o="' + o + '">' + o + '</span>'; }).join('') + '</div>';
    }).join('') + '</div></div>';
    if (cfg.p2.on) h += '<div class="panel"><div class="panel-head"><h3>Phần II</h3><span class="small muted">mỗi câu 4 ý a, b, c, d</span></div><div class="stack" style="gap:4px">' + a.p2.map(function (s, i) {
      return '<div class="q2" tabindex="0" data-p="2" data-i="' + i + '"><b class="small">Câu ' + (i + 1) + '</b>' + [0, 1, 2, 3].map(function (y) {
        return '<span class="y"><b>' + 'abcd'[y] + '</b><span class="bubble ' + (s[y] === 'Đ' ? 'on' : '') + '" data-y="' + y + '" data-o="Đ">Đ</span><span class="bubble ' + (s[y] === 'S' ? 'on' : '') + '" data-y="' + y + '" data-o="S">S</span></span>';
      }).join('') + '</div>';
    }).join('') + '</div></div>';
    if (cfg.p3.on) h += '<div class="panel"><div class="panel-head"><h3>Phần III</h3><span class="small muted">số, dấu phẩy thập phân, tối đa 4 ký tự (vd 0,31 hoặc -2,5)</span></div><div class="ans-grid">' + a.p3.map(function (x, i) {
      return '<div class="q q3"><span class="n">' + (i + 1) + '</span><input class="input input-sm a3" data-i="' + i + '" value="' + esc(x) + '" maxlength="4" inputmode="decimal" autocomplete="off"></div>';
    }).join('') + '</div></div>';
    var body = $('#aBody'); body.innerHTML = h;
    // Phần I
    $$('.q[data-p="1"]', body).forEach(function (q) {
      var i = +q.dataset.i;
      var set = function (o, adv) {
        a.p1[i] = a.p1[i] === o && !adv ? '' : o;
        $$('.bubble', q).forEach(function (bb) { bb.classList.toggle('on', bb.dataset.o === a.p1[i]); });
        changed();
        if (adv && a.p1[i]) focusQ('.q[data-p="1"][data-i="' + (i + 1) + '"]') || 0;
      };
      $$('.bubble', q).forEach(function (bb) { bb.onclick = function () { q.focus(); set(bb.dataset.o, false); }; });
      q.onkeydown = function (e) {
        var k = e.key.toUpperCase(), map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        if (/^[ABCD]$/.test(k) || map[k]) { e.preventDefault(); set(map[k] || k, true); if (i + 1 >= a.p1.length) focusQ(cfg.p2.on ? '.q2[data-i="0"]' : '.a3[data-i="0"]'); }
        else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); a.p1[i] = ''; $$('.bubble', q).forEach(function (bb) { bb.classList.remove('on'); }); changed(); focusQ('.q[data-p="1"][data-i="' + Math.max(0, i - 1) + '"]'); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusQ('.q[data-p="1"][data-i="' + (i + 1) + '"]'); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusQ('.q[data-p="1"][data-i="' + (i - 1) + '"]'); }
      };
    });
    // Phần II: gõ Đ/D/S điền lần lượt 4 ý
    $$('.q2', body).forEach(function (q) {
      var i = +q.dataset.i, pos = 0;
      var paint = function () { $$('.bubble', q).forEach(function (bb) { bb.classList.toggle('on', a.p2[i][+bb.dataset.y] === bb.dataset.o); }); };
      var setY = function (y, o) { var s = a.p2[i].split(''); s[y] = s[y] === o ? '_' : o; a.p2[i] = s.join(''); paint(); changed(); };
      $$('.bubble', q).forEach(function (bb) { bb.onclick = function () { setY(+bb.dataset.y, bb.dataset.o); }; });
      q.onfocus = function () { pos = Math.max(0, a.p2[i].indexOf('_')); if (pos < 0) pos = 0; };
      q.onkeydown = function (e) {
        var k = e.key.toUpperCase();
        if (k === 'Đ' || k === 'D' || k === 'S' || k === 'Đ'.toLowerCase()) {
          e.preventDefault();
          var s = a.p2[i].split(''); s[pos] = k === 'S' ? 'S' : 'Đ'; a.p2[i] = s.join(''); paint(); changed(); pos++;
          if (pos >= 4) { pos = 0; focusQ(i + 1 < a.p2.length ? '.q2[data-i="' + (i + 1) + '"]' : '.a3[data-i="0"]'); }
        } else if (e.key === 'Backspace') { e.preventDefault(); pos = Math.max(0, pos - 1); var s2 = a.p2[i].split(''); s2[pos] = '_'; a.p2[i] = s2.join(''); paint(); changed(); }
      };
    });
    // Phần III
    $$('.a3', body).forEach(function (inp) {
      var i = +inp.dataset.i;
      inp.oninput = function () {
        var val = inp.value.replace(/\./g, ',').replace(/[^0-9,\-]/g, '');
        if (val !== inp.value) inp.value = val;
        a.p3[i] = val; changed();
        inp.classList.toggle('is-bad', !!val && !/^-?\d+(,\d+)?$/.test(val) && !/^-?,\d+$/.test(val));
      };
      inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); var nx = $('.a3[data-i="' + (i + 1) + '"]'); if (nx) nx.focus(); else flush(); } };
    });
  };
  drawTabs(); drawBody(); setState();
  setTimeout(function () { focusQ('.q[data-p="1"][data-i="' + Math.max(0, ans[cur].p1.indexOf('')) + '"]'); }, 80);

  $('#aPaste').onclick = function () {
    Modal.open({ title: 'Dán nhanh đáp án mã ' + cur, size: 'lg', body: '<div class="stack">' +
      (cfg.p1.on ? '<div class="field"><label>Phần I (' + cfg.p1.soCau + ' chữ cái liền nhau)</label><input class="input" id="pp1" placeholder="vd: BBBACCABBAACABBACA" value="' + esc(ans[cur].p1.join('')) + '"></div>' : '') +
      (cfg.p2.on ? '<div class="field"><label>Phần II (' + cfg.p2.soCau + ' nhóm 4 chữ Đ/S, cách nhau bởi dấu cách)</label><input class="input" id="pp2" placeholder="vd: ĐSSĐ ĐSĐS SĐĐS ĐĐSS" value="' + esc(ans[cur].p2.join(' ').replace(/_/g, '')) + '"><div class="hint">Gõ D thay cho Đ cũng được</div></div>' : '') +
      (cfg.p3.on ? '<div class="field"><label>Phần III (' + cfg.p3.soCau + ' giá trị, cách nhau bởi dấu cách hoặc chấm phẩy)</label><input class="input" id="pp3" placeholder="vd: 50; 2; 22; 8; 157; 180" value="' + esc(ans[cur].p3.join('; ')) + '"></div>' : '') + '</div>',
      actions: [{ label: 'Hủy', kind: 'btn-ghost' }, { label: 'Điền vào mã ' + cur, kind: 'btn-primary', onClick: function (c) {
        var a = ans[cur];
        if (c.$('#pp1')) { var s = c.$('#pp1').value.toUpperCase().replace(/[^ABCD]/g, ''); a.p1 = a.p1.map(function (_, i) { return s[i] || ''; }); }
        if (c.$('#pp2')) { var g = c.$('#pp2').value.toUpperCase().replace(/D/g, 'Đ').replace(/[^ĐS\s]/g, '').trim().split(/\s+/); a.p2 = a.p2.map(function (_, i) { return ((g[i] || '') + '____').slice(0, 4).replace(/[^ĐS]/g, '_'); }); }
        if (c.$('#pp3')) { var t = c.$('#pp3').value.replace(/\./g, ',').split(/[;\s]+/).filter(Boolean); a.p3 = a.p3.map(function (_, i) { return (t[i] || '').slice(0, 4); }); }
        changed(); drawBody(); c.close(); toast('Đã điền đáp án mã ' + cur, 'success');
      } }] });
  };
  $('#aGen').onclick = async function () {
    var thieu = mas.map(function (m) { return { m: m, f: keyFilled(cfg, ans[m]) }; }).filter(function (x) { return !x.f.done; });
    if (thieu.length) {
      var md = Modal.open({ title: 'Chưa đủ đáp án', body: '<p style="margin-bottom:10px">Cần nhập đủ mọi câu của mọi mã đề mới tạo được file cho TNMaker.</p><div class="list">' + thieu.map(function (x) {
        return '<a class="item" href="javascript:void 0" data-m="' + esc(x.m) + '"><span class="ring" style="--p:' + Math.round(x.f.n * 100 / Math.max(1, x.f.need)) + '"></span><div class="grow t">Mã ' + esc(x.m) + '</div><span class="small muted">còn thiếu ' + (x.f.need - x.f.n) + ' câu</span>' + icon('chevR', 'chev') + '</a>';
      }).join('') + '</div>', actions: [{ label: 'Đóng', kind: 'btn-primary' }] });
      md.$$('[data-m]').forEach(function (a) { a.onclick = function () { cur = a.dataset.m; md.close(); drawTabs(); drawBody(); }; });
      return;
    }
    var btn = this;
    await flush();
    if (Object.keys(dirty).length) { toast('Chưa lưu được đáp án, thử lại sau', 'error'); return; }
    genFile(btn, b);
  };
}

/* ---------------- tải PDF thành ảnh ---------------- */
async function openPdfWizard(fileList, maBai, existing) {
  var pdfjsLib;
  var m0 = Modal.open({ title: 'Đang chuẩn bị', body: '<div class="row"><span class="spin"></span><span>Đang tải bộ đọc PDF…</span></div>', dismissible: false });
  try { pdfjsLib = await needPDF(); } catch (e) { m0.close(); toastErr(e); return; }
  var items = [], mode = 'append';
  var addFiles = async function (list) {
    var files = Array.from(list || []).filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!files.length) { toast('Hãy chọn file PDF', 'error'); return; }
    for (var i = 0; i < files.length; i++) {
      try { var doc = await pdfjsLib.getDocument({ data: await files[i].arrayBuffer() }).promise; items.push({ name: files[i].name, doc: doc, extra: 0 }); }
      catch (e) { toast('Không đọc được "' + files[i].name + '"', 'error'); }
    }
  };
  await addFiles(fileList);
  m0.close();
  if (!items.length) return;
  var m = null;
  var drawThumb = async function (i) {
    var cv = m && m.$('.pvCv[data-i="' + i + '"]'); if (!cv || !items[i]) return;
    try { await renderPreview(cv, items[i].doc, items[i].extra, 150); } catch (e) {}
  };
  var render = function () {
    var total = items.reduce(function (s, d) { return s + d.doc.numPages; }, 0);
    var body = '<p class="muted" style="margin-bottom:12px"><b>' + items.length + '</b> file, <b>' + total + '</b> trang (mỗi trang một phiếu). Mỗi file xoay riêng được: kiểm tra phiếu đầu đã đứng thẳng chưa.</p>' +
      '<div class="stack" style="gap:10px">' + items.map(function (d, i) {
        return '<div class="row pvItem" data-i="' + i + '" style="align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:12px;flex-wrap:nowrap"><canvas class="pvCv" data-i="' + i + '" style="width:96px;border:1px solid var(--line);border-radius:6px;background:#fff;flex:none"></canvas>' +
          '<div class="grow"><div style="font-weight:600;word-break:break-all">' + esc(d.name) + '</div><div class="small muted">' + d.doc.numPages + ' trang</div>' +
          '<div class="row" style="margin-top:8px;gap:6px"><button class="btn btn-sm pvL">↺ Xoay trái</button><button class="btn btn-sm pvR">↻ Xoay phải</button><button class="btn btn-sm btn-ghost pvX">' + icon('x') + '<span>Bỏ</span></button></div></div></div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn btn-sm" id="pvAdd">' + icon('plus') + '<span>Thêm file PDF khác</span></button><span class="small muted">file ở thư mục khác thì thêm ở đây</span><input type="file" id="pvAddIn" accept="application/pdf,.pdf" multiple class="hidden"></div>' +
      (existing > 0 ? '<div class="field" style="margin-top:14px"><label>Thư mục ảnh đã có ' + existing + ' ảnh</label><label class="row small"><input type="radio" name="pvMode" value="append"> Thêm tiếp vào ảnh đã có</label><label class="row small"><input type="radio" name="pvMode" value="replace"> Xóa ảnh cũ, làm lại (ảnh cũ vào thùng rác Drive)</label></div>' : '');
    if (!m) m = Modal.open({ title: 'Tải bài làm lên', size: 'lg', body: body, dismissible: false,
      actions: [{ label: 'Hủy', kind: 'btn-ghost', onClick: function (c) { c.close(); items.forEach(function (d) { try { d.doc.destroy(); } catch (e) {} }); } },
        { label: 'Bắt đầu tải lên', kind: 'btn-primary', id: 'pvGo', icon: 'upload', onClick: function (c) { c.close(); startUpload(items, maBai, existing, mode, items.reduce(function (s, d) { return s + d.doc.numPages; }, 0)); } }] });
    else m.setBody(body);
    m.$('#pvGo span').textContent = 'Bắt đầu tải lên (' + total + ' trang)';
    items.forEach(function (_, i) { drawThumb(i); });
    m.$$('.pvItem').forEach(function (el) {
      var i = +el.dataset.i;
      el.querySelector('.pvL').onclick = function () { items[i].extra = (items[i].extra + 270) % 360; drawThumb(i); };
      el.querySelector('.pvR').onclick = function () { items[i].extra = (items[i].extra + 90) % 360; drawThumb(i); };
      el.querySelector('.pvX').onclick = function () { var x = items.splice(i, 1)[0]; try { x.doc.destroy(); } catch (e) {} if (!items.length) m.close(); else render(); };
    });
    m.$('#pvAdd').onclick = function () { m.$('#pvAddIn').click(); };
    m.$('#pvAddIn').onchange = async function (e) { var arr = Array.from(e.target.files || []); e.target.value = ''; await addFiles(arr); render(); };
    m.$$('input[name=pvMode]').forEach(function (r) { r.checked = r.value === mode; r.onchange = function () { mode = r.value; }; });
  };
  render();
}

async function startUpload(docs, maBai, existing, mode, total) {
  var state = { cancel: false, failed: [], done: 0, concurrency: 3, tries: 3 };
  var ctx = { state: state, total: total, maBai: maBai, docs: docs };
  try {
    if (mode === 'replace' && existing > 0) await Api.call('clearAnh', { maBai: maBai });
  } catch (e) { toastErr(e); return; }
  var items = [], n = mode === 'replace' ? 0 : existing;
  docs.forEach(function (d) { for (var p = 1; p <= d.doc.numPages; p++) { n++; items.push({ doc: d.doc, p: p, extra: d.extra, name: 'p' + String(n).padStart(4, '0') + '.jpg' }); } });
  uploadStage(ctx, items);
}
async function uploadStage(ctx, items) {
  var state = ctx.state, total = ctx.total, maBai = ctx.maBai, t0 = Date.now();
  state.cancel = false; state.failed = [];
  var m = Modal.open({ title: 'Đang tải ảnh lên', dismissible: false,
    body: '<p class="muted" style="margin-bottom:12px">Giữ trang này mở. Mỗi ảnh đi thẳng vào thư mục của bài trên Drive.</p><div class="progress"><i id="upBar"></i></div><div class="row" style="margin-top:10px"><b id="upTxt" class="num">0/' + items.length + '</b><span class="grow"></span><span id="upEta" class="small muted"></span></div>',
    actions: [{ label: 'Dừng', kind: 'btn-ghost', id: 'upStop', onClick: function () { state.cancel = true; m.$('#upStop').disabled = true; } }] });
  var doneLocal = 0;
  state.onProgress = function () {
    var x = doneLocal + state.failed.length, pct = Math.round(x * 100 / Math.max(1, items.length));
    var bar = m.$('#upBar'); if (bar) bar.style.width = pct + '%';
    var tx = m.$('#upTxt'); if (tx) tx.textContent = doneLocal + '/' + items.length;
    var el = (Date.now() - t0) / 1000, rate = x / Math.max(1, el), left = rate ? Math.round((items.length - x) / rate) : 0;
    var eta = m.$('#upEta'); if (eta && x > 2) eta.textContent = 'còn khoảng ' + (left > 90 ? Math.round(left / 60) + ' phút' : left + ' giây');
  };
  var renderFn = async function (it) { return it._data || await pageToJpegBase64(it.doc, it.p, it.extra); };
  var uploadFn = async function (it, data) { await Api.call('uploadAnh', { maBai: maBai, name: it.name, data: data }, { silent: true, retry: 0, timeout: 60000 }); doneLocal++; };
  await runUploadQueue(items, renderFn, uploadFn, state);
  m.close();
  var info = null;
  try { info = await Api.call('finishAnh', { maBai: maBai }, { silent: true }); } catch (e) {}
  if (state.authLost) return;
  ctx.docs.forEach(function (d) { try { if (!state.failed.length) d.doc.destroy(); } catch (e) {} });
  var failed = state.failed.slice();
  var body = failed.length
    ? '<div class="note warn">' + icon('alert') + '<div>Đã tải <b>' + doneLocal + '</b> ảnh, <b>' + failed.length + '</b> ảnh lỗi' + (state.lastError ? ' (' + esc(state.lastError) + ')' : '') + '. Bấm "Tải lại ảnh lỗi" để thử tiếp.</div></div>'
    : '<div class="note green">' + icon('okc') + '<div>Đã tải đủ <b>' + doneLocal + '</b> trang' + (state.cancel ? ' (đã dừng giữa chừng)' : '') + '.' + (info && !info.hasDapAn ? ' Bài chưa có file đáp án trên hệ thống, không sao: chấm bằng file đáp án m có sẵn cũng được.' : '') + (info && info.emailSent ? ' Đã gửi email báo.' : '') + '</div></div>';
  Modal.open({ title: failed.length ? 'Tải xong, còn ảnh lỗi' : 'Tải ảnh xong', body: body, dismissible: false,
    actions: (failed.length ? [{ label: 'Tải lại ảnh lỗi', kind: '', onClick: function (c) { c.close(); uploadStage(ctx, failed.map(function (f) { return Object.assign({}, f.item, { _data: f.data }); })); } }] : [])
      .concat([{ label: 'Xong', kind: 'btn-primary', id: 'upDone', onClick: function (c) { c.close(); if (Router.cur === '/bai/' + maBai) screenBaiHub({ id: maBai }); } }]) });
}

window.registerBaiRoutes = function () {
  Router.on('/bai', screenBaiList, { nav: 'bai' });
  Router.on('/bai/moi', function () { return isAdmin() ? Router.go('/bai') : screenBaiConfig({}); }, { nav: 'bai' });
  Router.on('/bai/:id', screenBaiHub, { nav: 'bai' });
  Router.on('/bai/:id/sua', screenBaiConfig, { nav: 'bai' });
  Router.on('/bai/:id/dap-an', screenAnswers, { nav: 'bai' });
};
