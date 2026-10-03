/* SỔ ĐIỂM — đọc file điểm TNMaker và xuất bảng điểm Excel (hàm thuần, không phụ thuộc giao diện) */
'use strict';
/* >>> PARSE-TNMAKER */
function nfc(s){ return String(s==null?'':s).normalize('NFC'); }
function normSbdClient(v){
  let s = String(v==null?'':v).trim();
  if(/^\d+(\.0+)?$/.test(s)) s = String(parseInt(s,10));
  s = s.replace(/\D/g,'');
  while(s.length && s.length<6) s = '0'+s;
  return s;
}
function normMaDeClient(v){
  const s = String(v==null?'':v).trim();
  return /^\d+(\.0+)?$/.test(s) ? ('00'+parseInt(s,10)).slice(-3) : s;
}
function toNum(v){
  if(typeof v === 'number') return v;
  const t = String(v==null?'':v).trim();
  return t === '' ? NaN : Number(t.replace(',','.'));
}

// Đọc 2 tab của file điểm TNMaker (đã đổi sang mảng 2 chiều). Không phụ thuộc thư viện, chạy được ở trình duyệt và node.
function parseTnmakerAoa(scoreAoa, statAoa){
  const warnings = [];
  const hdr = (scoreAoa[0]||[]).map(x=>nfc(x).trim().toLowerCase());
  const col = name => hdr.indexOf(name);
  const cSbd = col('số báo danh'), cMa = col('mã đề'), cTong = col('tổng điểm');
  const cP1 = col('p1'), cP2 = col('p2'), cP3 = col('p3'), cBai = col('kiểm tra');
  if(cSbd<0 || cMa<0 || cTong<0) throw new Error('Không đúng định dạng file điểm TNMaker (thiếu cột Số báo danh, Mã đề hoặc Tổng điểm).');

  const rows = []; let tenBai = '';
  for(let i=1; i<scoreAoa.length; i++){
    const r = scoreAoa[i];
    if(!r || r[cSbd]==='' || r[cSbd]==null) continue;
    if(!tenBai && cBai>=0) tenBai = nfc(r[cBai]).trim();
    const o = {
      sbd: normSbdClient(r[cSbd]), maDe: normMaDeClient(r[cMa]),
      tong: toNum(r[cTong]), p1: cP1>=0?toNum(r[cP1]):0, p2: cP2>=0?toNum(r[cP2]):0, p3: cP3>=0?toNum(r[cP3]):0, tl: null
    };
    if(!isFinite(o.tong)){ warnings.push('Dòng '+(i+1)+': điểm không phải số, đã bỏ qua (SBD '+o.sbd+')'); continue; }
    ['p1','p2','p3'].forEach(k=>{ if(!isFinite(o[k])) o[k] = 0; });
    rows.push(o);
  }
  if(!rows.length) throw new Error('File không có dòng điểm nào.');

  const keys = {}; let shape = null;
  if(statAoa && statAoa.length > 1){
    const h = (statAoa[0]||[]).map(x=>nfc(x).trim());
    const lo = h.map(x=>x.toLowerCase());
    const cS = lo.indexOf('số báo danh'), cM = lo.indexOf('mã đề'), cC = lo.indexOf('câu');
    if(cS>=0 && cM>=0 && cC>=0){
      // Chia các cột câu hỏi thành 3 phần theo nhãn: 1..n | 1a..nd | 1..m
      const part = []; let cur = 1, seenP2 = false, prevNum = 0;
      for(let c=cC+1; c<h.length; c++){
        const lb = h[c];
        if(/^\d+[a-dA-D]$/.test(lb)){ cur = 2; seenP2 = true; }
        else if(/^\d+$/.test(lb)){
          const n = parseInt(lb,10);
          if(seenP2 || n <= prevNum) cur = 3;
          prevNum = n;
        }
        part[c] = cur;
      }
      const parseRow = row => {
        const a = {p1:[], p2cells:[], p3:[]};
        for(let c=cC+1; c<h.length; c++){
          const v = nfc(row[c]).trim();
          if(part[c]===1) a.p1.push(v.toUpperCase()==='X' ? '' : v.toUpperCase());
          else if(part[c]===2){ const u = v.toUpperCase(); a.p2cells.push(u==='Đ'||u==='S' ? u : '_'); }
          else a.p3.push(v.toUpperCase()==='X' ? '' : v.replace(/_+$/,''));
        }
        const p2 = [];
        for(let i=0; i<a.p2cells.length; i+=4) p2.push(a.p2cells.slice(i,i+4).join('').padEnd(4,'_'));
        return {p1:a.p1, p2, p3:a.p3};
      };
      const recs = [];
      for(let r=1; r<statAoa.length; r++){
        const row = statAoa[r]; if(!row) continue;
        const tag = nfc(row[cC]).trim();
        if(tag === 'Trả lời') recs.push({sbd:normSbdClient(row[cS]), maDe:normMaDeClient(row[cM]), tl:parseRow(row), key:null, used:false});
        else if(tag === 'Đáp án' && recs.length && !recs[recs.length-1].key) recs[recs.length-1].key = parseRow(row);
      }
      if(recs.length){
        shape = {n1: part.filter(x=>x===1).length, n2: part.filter(x=>x===2).length/4, n3: part.filter(x=>x===3).length};
        let khongDong = 0;
        const keyBad = {};
        rows.forEach(row=>{
          const rec = recs.find(x=>!x.used && x.sbd===row.sbd && x.maDe===row.maDe);
          if(!rec){ khongDong++; return; }
          rec.used = true; row.tl = rec.tl;
          if(rec.key){
            const k = JSON.stringify(rec.key);
            if(!keys[row.maDe]) keys[row.maDe] = rec.key;
            else if(JSON.stringify(keys[row.maDe]) !== k) keyBad[row.maDe] = true;
          }
        });
        if(khongDong) warnings.push(khongDong+' dòng điểm không có chi tiết câu trả lời trong tab Thống kê.');
        Object.keys(keyBad).forEach(m=> warnings.push('Đáp án của mã đề '+m+' không đồng nhất giữa các học sinh trong file.'));
        const thua = recs.filter(x=>!x.used).length;
        if(thua) warnings.push(thua+' dòng trong tab Thống kê không có trong Bảng điểm tổng (bỏ qua).');
      }
    }
  }
  if(!shape) warnings.push('File không có tab Thống kê hợp lệ: vẫn nhập được điểm, nhưng sẽ không xem được câu sai.');
  return {tenBai, rows, keys, shape, warnings};
}
/* <<< PARSE-TNMAKER */

/* >>> EXPORT */
function fmtNum(n){ return Math.round(Number(n)*100)/100; }
function spaceSbd(s){ s = String(s||''); return s.slice(0,3)+' '+s.slice(3); }
function safeSheetName(name, used){
  const base = String(name||'Nhóm').replace(/[\\\/\?\*\[\]:]/g,' ').replace(/\s+/g,' ').trim().slice(0,28) || 'Nhóm';
  let n = base, k = 2;
  while(used[n.toLowerCase()]){ n = base+' '+k; k++; }
  used[n.toLowerCase()] = 1;
  return n;
}
// Bảng điểm giống mẫu mẹ đang dùng: mỗi nhóm một tab, dòng 1 là tiêu đề nhóm, dòng 2 là tên cột.
function buildExportWorkbook(X, data){
  const wb = X.utils.book_new(), used = {};
  data.groups.forEach(g=>{
    const list = g.students;
    if(!list.length) return;
    const aoa = [];
    aoa.push(['NHÓM '+g.tenNhom+' – SỐ BÁO DANH '+spaceSbd(list[0].sbd)+'- '+spaceSbd(list[list.length-1].sbd)]);
    aoa.push(['STT','HỌ','TÊN','SBD','LỚP','MÃ ĐỀ','ĐIỂM','P1','P2','P3','GHI CHÚ']);
    list.forEach((s,i)=>{
      const k = s.kq;
      aoa.push([i+1, s.ho||'', s.ten||'', s.sbd, s.lop||'', k?k.maDe:'', k?fmtNum(k.tong):'', k?fmtNum(k.p1):'', k?fmtNum(k.p2):'', k?fmtNum(k.p3):'', k?(k.daSua?'Đã sửa':''):'Vắng']);
    });
    const ws = X.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:10}}];
    ws['!cols'] = [{wch:5},{wch:18},{wch:10},{wch:9},{wch:7},{wch:7},{wch:7},{wch:6},{wch:6},{wch:6},{wch:10}];
    X.utils.book_append_sheet(wb, ws, safeSheetName(g.tenNhom, used));
  });
  if(data.orphan && data.orphan.length){
    const aoa = [['SBD','MÃ ĐỀ','ĐIỂM','P1','P2','P3','GHI CHÚ']];
    data.orphan.forEach(o=> aoa.push([o.sbd, o.kq.maDe, fmtNum(o.kq.tong), fmtNum(o.kq.p1), fmtNum(o.kq.p2), fmtNum(o.kq.p3), o.kq.daSua?'Đã sửa':'Không còn trong danh sách']));
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), safeSheetName('Khác', used));
  }
  if(!wb.SheetNames.length) throw new Error('Chưa có dữ liệu để xuất');
  return wb;
}
/* <<< EXPORT */
