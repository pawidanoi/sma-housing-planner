const TODAY = new Date(); TODAY.setHours(0,0,0,0);

function toRad(d){return d*Math.PI/180}
function hav(la1,lo1,la2,lo2){
  const R=6371,p1=toRad(la1),p2=toRad(la2),dphi=toRad(la2-la1),dlmb=toRad(lo2-lo1);
  const a=Math.sin(dphi/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dlmb/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
function rooms(male,female){return Math.ceil(male/2)+Math.ceil(female/2)}
function daysUntil(dateStr){return Math.round((new Date(dateStr+'T00:00:00')-TODAY)/86400000)}
function nightsBetween(s,e){return Math.max(1,Math.round((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000))}
function overlaps(s1,e1,s2,e2){return new Date(s1)<=new Date(e2) && new Date(s2)<=new Date(e1)}
function fmtBaht(n){return n.toLocaleString('th-TH',{maximumFractionDigits:0})}
function branchLabel(b){return b.n+' — '+b.d+', '+b.pv+' ('+b.c+')'}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}

/* ================= API sync layer ================= */
const APPDATA = { branches: [], hotels: [], employees: [] };
let scheduleData = [];
const branchByCode = {};

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch(e){}
    throw new Error(msg);
  }
  return res.json();
}
function applyState(state) {
  APPDATA.branches = state.branches;
  APPDATA.hotels = state.hotels;
  APPDATA.employees = state.employees;
  scheduleData = state.schedule;
  rebuildBranchByCode();
}
async function loadState() {
  const state = await api('/api/state');
  applyState(state);
}

function nearestHotels(la,lo,limit){
  return APPDATA.hotels.map(h=>Object.assign({},h,{dist:hav(la,lo,h.la,h.lo)}))
    .sort((a,b)=>a.dist-b.dist).slice(0,limit||APPDATA.hotels.length);
}

/* ---------- tabs ---------- */
const TABS = [
  {id:'overview',label:'ภาพรวม',emoji:'🗺️',color:'cobalt'},
  {id:'nearest',label:'ที่พักแนะนำตามสาขา',emoji:'🏨',color:'teal'},
  {id:'cluster',label:'รวมที่พักได้',emoji:'🤝',color:'coral'},
  {id:'midpoint',label:'จุดกลาง 2 สาขา',emoji:'🚗',color:'mustard'},
  {id:'empcoverage',label:'บ้านพนักงานใกล้สาขา',emoji:'🏠',color:'violet'},
  {id:'archive',label:'จัดเก็บ',emoji:'🗄️',color:'plum'},
];
const tabnav = document.getElementById('tabnav');
TABS.forEach(t=>{
  const b = document.createElement('button');
  b.className='tabbtn'+(t.id==='overview'?' active':'');
  b.dataset.tab=t.id; b.dataset.color=t.color;
  b.innerHTML = '<span>'+t.emoji+'</span>'+t.label;
  b.addEventListener('click',()=>showTab(t.id));
  tabnav.appendChild(b);
});
let mapObj=null;
function showTab(id){
  document.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.tab===id));
  if(id==='overview' && mapObj){ setTimeout(()=>mapObj.invalidateSize(),80); }
}

/* ---------- searchable branch picker (type-to-filter, replaces plain <select>) ---------- */
const BRANCH_PICKERS = {};
function normSearch(s){ return String(s||'').toLowerCase(); }
function createBranchPicker(id, initialList, opts){
  opts = opts || {};
  const input = document.getElementById(id);
  const listEl = document.getElementById(id+'-list');
  let items = (initialList||[]).slice().sort((a,b)=>a.pv.localeCompare(b.pv,'th'));
  let filtered = [];
  let hiIndex = -1;

  function labelFor(code){
    if(code==='' && opts.emptyLabel) return opts.emptyLabel;
    const b = items.find(x=>x.c===code);
    return b ? branchLabel(b) : '';
  }
  function renderOptions(){
    listEl.innerHTML = filtered.length
      ? filtered.map((b,i)=>'<div class="bp-opt'+(i===hiIndex?' hi':'')+'" data-code="'+esc(b.c)+'">'+(b.__empty?esc(b.n):esc(branchLabel(b)))+'</div>').join('')
      : '<div class="bp-empty">ไม่พบสาขาที่ตรงกับคำค้นหา</div>';
  }
  function openWith(filterText){
    const q = normSearch(filterText);
    let base = items;
    filtered = !q ? base.slice(0,80) : base.filter(b=>normSearch(branchLabel(b)).includes(q)).slice(0,80);
    if(opts.emptyLabel && (!q || normSearch(opts.emptyLabel).includes(q))){
      filtered = [{c:'', n:opts.emptyLabel, d:'', pv:'', lo:0, la:0, __empty:true}, ...filtered];
    }
    hiIndex = -1;
    renderOptions();
    listEl.style.display = 'block';
  }
  function close(){ listEl.style.display = 'none'; hiIndex = -1; }
  function commit(code, silent){
    input.dataset.code = code || '';
    input.value = labelFor(code);
    close();
    if(!silent) input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  input.addEventListener('focus', ()=>{ input.select(); openWith(''); });
  input.addEventListener('input', ()=>{ openWith(input.value); });
  input.addEventListener('keydown', e=>{
    if(listEl.style.display!=='block') return;
    if(e.key==='ArrowDown'){ e.preventDefault(); hiIndex = Math.min(hiIndex+1, filtered.length-1); renderOptions(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); hiIndex = Math.max(hiIndex-1, 0); renderOptions(); }
    else if(e.key==='Enter'){ e.preventDefault(); const pick = filtered[hiIndex>=0?hiIndex:0]; if(pick) commit(pick.c); }
    else if(e.key==='Escape'){ close(); input.value = labelFor(input.dataset.code||''); }
  });
  input.addEventListener('blur', ()=>{
    setTimeout(()=>{ close(); input.value = labelFor(input.dataset.code||''); }, 120);
  });
  listEl.addEventListener('mousedown', e=>{
    const opt = e.target.closest('.bp-opt');
    if(!opt) return;
    e.preventDefault();
    commit(opt.dataset.code);
  });

  function defaultCode(){
    if(opts.emptyLabel) return '';
    const i = opts.defaultIndex || 0;
    return items[i] ? items[i].c : (items[0] ? items[0].c : '');
  }
  const picker = {
    setList(newList, keepIfValid){
      items = (newList||[]).slice().sort((a,b)=>a.pv.localeCompare(b.pv,'th'));
      const cur = input.dataset.code || '';
      const stillValid = keepIfValid!==false && (cur==='' ? !!opts.emptyLabel : items.some(x=>x.c===cur));
      if(stillValid){ input.value = labelFor(cur); }
      else { commit(defaultCode(), true); }
    },
    getValue(){ return input.dataset.code || ''; },
    setValue(code, silent){ commit(code||'', !!silent); },
  };
  commit(defaultCode(), true);
  BRANCH_PICKERS[id] = picker;
  return picker;
}
function setBranchPickerList(id, list, keepIfValid){ BRANCH_PICKERS[id] && BRANCH_PICKERS[id].setList(list, keepIfValid); }
function getBranchPickerValue(id){ return BRANCH_PICKERS[id] ? BRANCH_PICKERS[id].getValue() : ''; }
function setBranchPickerValue(id, code, silent){ BRANCH_PICKERS[id] && BRANCH_PICKERS[id].setValue(code, silent); }

const nearestSel = document.getElementById('nearest-branch');
const midA = document.getElementById('mid-branch-a');
const midB = document.getElementById('mid-branch-b');
const empSel = document.getElementById('emp-branch');
const impBranchSel = document.getElementById('imp-branch');
const impBranch2Sel = document.getElementById('imp-branch2');
createBranchPicker('nearest-branch', []);
createBranchPicker('mid-branch-a', []);
createBranchPicker('mid-branch-b', [], {defaultIndex:1});
createBranchPicker('emp-branch', []);
createBranchPicker('imp-branch', []);
createBranchPicker('imp-branch2', [], {emptyLabel:'— ไม่มี —'});

function refreshMetaCounts(){
  document.getElementById('meta-branch-count').textContent = APPDATA.branches.length;
  document.getElementById('meta-hotel-count').textContent = APPDATA.hotels.length;
  document.getElementById('meta-emp-count').textContent = APPDATA.employees.length;
  document.getElementById('codebook-count').textContent = APPDATA.branches.length;
  document.getElementById('codebook-list').innerHTML = APPDATA.branches.slice()
    .sort((a,b)=>a.pv.localeCompare(b.pv,'th'))
    .map(b=>b.c+' — '+b.n+' ('+b.pv+')').join('<br>');
}

/* ================= OVERVIEW: kpi + map + table + multi-branch jobs ================= */
function isArchived(s){ return daysUntil(s.work_end) < 0; }
function activeScheduleData(){ return scheduleData.filter(s=>!isArchived(s)); }
function archivedScheduleData(){ return scheduleData.filter(s=>isArchived(s)); }
function scopedBranchSet(){
  const toggle = document.getElementById('scope-toggle');
  if(!toggle || !toggle.checked) return null;
  const codes = new Set();
  activeScheduleData().forEach(s=>s.branches.forEach(c=>codes.add(c)));
  return codes.size ? codes : null;
}
function scopedBranchList(){
  const scope = scopedBranchSet();
  return scope ? APPDATA.branches.filter(b=>scope.has(b.c)) : APPDATA.branches.slice();
}
function coverageStats(){
  const scope = scopedBranchSet();
  const branchList = scope ? APPDATA.branches.filter(b=>scope.has(b.c)) : APPDATA.branches;
  return branchList.map(b=>{
    const list = APPDATA.hotels.map(h=>Object.assign({},h,{dist:hav(b.la,b.lo,h.la,h.lo)})).sort((x,y)=>x.dist-y.dist);
    const within = list.filter(h=>h.dist<=15);
    let status='ok', label='เพียงพอ';
    if(within.length===0){status='danger';label='ไม่มีเลย';}
    else if(within.length<=2){status='warn';label='มีน้อย';}
    const items = activeScheduleData().filter(s=>s.branches.includes(b.c));
    const nextDate = items.length ? items.map(s=>s.work_start).sort()[0] : null;
    return {b, within, nearestAll:list, status, label, nextDate};
  });
}
function renderOverviewKPIs(){
  const stats = coverageStats();
  const dangerCount = stats.filter(s=>s.status==='danger').length;
  const archivedCount = archivedScheduleData().length;
  document.getElementById('overview-kpis').innerHTML =
    '<div class="kpi"><div class="badge cobalt">📍</div><div><div class="lbl">สาขาที่แสดงอยู่</div><div class="val">'+stats.length+'</div></div></div>'+
    '<div class="kpi"><div class="badge teal">🏨</div><div><div class="lbl">ที่พักในทะเบียน</div><div class="val">'+APPDATA.hotels.length+'</div></div></div>'+
    '<div class="kpi"><div class="badge red">⚠️</div><div><div class="lbl">ต้องรีบหาเพิ่ม</div><div class="val red">'+dangerCount+'</div></div></div>'+
    '<div class="kpi"><div class="badge violet">📋</div><div><div class="lbl">แผนงานที่ใช้งานอยู่</div><div class="val">'+activeScheduleData().length+'</div></div></div>'+
    '<div class="kpi"><div class="badge plum">🗄️</div><div><div class="lbl">จัดเก็บแล้ว (จบงาน)</div><div class="val">'+archivedCount+'</div></div></div>';
}
function renderOverviewTable(){
  const stats = coverageStats();
  if(stats.length===0){
    document.getElementById('overview-table').innerHTML =
      '<div class="banner warn">🟡 ยังไม่มีแผนงาน — อัพโหลดไฟล์แผนงานหรือเพิ่มทีละรายการด้านบน (หรือปลดติ๊ก &ldquo;แสดงเฉพาะสาขาที่มีแผนงาน&rdquo; เพื่อดูทั้งทะเบียน)</div>';
    return;
  }
  const filterText = (document.getElementById('overview-search').value||'').toLowerCase();
  let rows = stats.filter(r=> !filterText || r.b.n.toLowerCase().includes(filterText) || r.b.pv.toLowerCase().includes(filterText) || r.b.d.toLowerCase().includes(filterText));
  const sevRank = {danger:0,warn:1,ok:2};
  rows.sort((a,b2)=>{
    if(sevRank[a.status]!==sevRank[b2.status]) return sevRank[a.status]-sevRank[b2.status];
    const da = a.nextDate?daysUntil(a.nextDate):Infinity, db = b2.nextDate?daysUntil(b2.nextDate):Infinity;
    return da-db;
  });
  let html = '<table class="dtable"><thead><tr><th>สาขา</th><th>จังหวัด</th><th>ที่พักในระยะ 15 กม.</th>'+
    '<th>แผนงานถัดไป</th><th>สถานะ</th><th></th></tr></thead><tbody>';
  rows.forEach(r=>{
    const nextTxt = r.nextDate ? ('<span class="num">'+r.nextDate+'</span> <span class="chip tag">'+daysUntil(r.nextDate)+' วัน</span>') : '<span class="sub" style="color:var(--ink-3)">—</span>';
    const chip = r.status==='danger' ? '<span class="chip danger">⚠️ ไม่มีเลย</span>' : (r.status==='warn' ? '<span class="chip warn">🟡 มีน้อย</span>' : '<span class="chip ok">✅ เพียงพอ</span>');
    html += '<tr class="status-'+r.status+'"><td><b>'+r.b.n+'</b><br><span class="chip tag">'+r.b.c+'</span></td><td>'+r.b.d+', '+r.b.pv+'</td>'+
      '<td class="num">'+r.within.length+' แห่ง</td><td>'+nextTxt+'</td><td>'+chip+'</td>'+
      '<td><button class="btn sm ghost" data-toggle="'+r.b.c+'">ดูรายละเอียด ▾</button></td></tr>';
    html += '<tr class="detail-row" id="detail-'+r.b.c+'" style="display:none"><td colspan="6">';
    if(r.within.length===0){
      const closest = r.nearestAll[0];
      html += '<div class="banner danger">⚠️ ไม่มีที่พักในระยะ 15 กม. จากสาขานี้เลย — ควรหาที่พักเพิ่มเข้าทะเบียนก่อนมีแผนงาน'+
        (closest?('<br>ที่ใกล้สุดที่มีตอนนี้: '+closest.n+' ห่าง '+closest.dist.toFixed(1)+' กม. (เกินเกณฑ์)'):'')+'</div>';
    } else {
      html += r.within.slice(0,10).map(h=>'<div class="reco-row"><span>🏨 '+h.n+' <span class="sub" style="color:var(--ink-3)">('+h.pv+')</span></span>'+
        '<span class="num">'+h.dist.toFixed(1)+' กม. · ฿'+fmtBaht(h.pr)+'</span></div>').join('');
    }
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('overview-table').innerHTML = html;
}
document.getElementById('overview-table').addEventListener('click', e=>{
  const btn = e.target.closest('[data-toggle]');
  if(!btn) return;
  const row = document.getElementById('detail-'+btn.dataset.toggle);
  const open = row.style.display!=='none';
  row.style.display = open?'none':'table-row';
  btn.textContent = open ? 'ดูรายละเอียด ▾' : 'ซ่อนรายละเอียด ▴';
});
document.getElementById('overview-search').addEventListener('input', renderOverviewTable);

const SAME_TEAM_MULTI_BRANCH_KM = 30;
function findSameTeamMultiBranch(){
  const single = activeScheduleData().filter(s=>s.branches.length===1);
  const out = [];
  for(let i=0;i<single.length;i++){
    for(let j=i+1;j<single.length;j++){
      const A=single[i], B=single[j];
      if(A.team!==B.team) continue;
      if(A.branches[0]===B.branches[0]) continue;
      const bA=branchByCode[A.branches[0]], bB=branchByCode[B.branches[0]];
      if(!bA||!bB) continue;
      const dist = hav(bA.la,bA.lo,bB.la,bB.lo);
      if(dist>SAME_TEAM_MULTI_BRANCH_KM) continue;
      if(overlaps(A.work_start,A.work_end,B.work_start,B.work_end)){
        out.push({team:A.team, branches:[A.branches[0],B.branches[0]], work_start:A.work_start, work_end:A.work_end, dist, detected:true});
      }
    }
  }
  return out;
}
function renderMultiBranchJobs(){
  const explicit = activeScheduleData().filter(s=>s.branches.length>1)
    .map(s=>({team:s.team, branches:s.branches, work_start:s.work_start, work_end:s.work_end, detected:false}));
  const detected = findSameTeamMultiBranch();
  const all = [...explicit, ...detected];
  const box = document.getElementById('multi-branch-jobs');
  if(all.length===0){ box.innerHTML=''; return; }
  let html = '<h3 style="font-size:15px;margin:18px 0 10px">🚗 งานที่ 1 ทีมต้องดูแล 2 สาขาพร้อมกัน</h3>';
  all.forEach(item=>{
    const bs = item.branches.map(c=>branchByCode[c]).filter(Boolean);
    if(bs.length<2) return;
    const tag = item.detected ? '<span class="chip warn">ตรวจพบจากแผนงาน &middot; ห่างกัน '+item.dist.toFixed(1)+' กม.</span>' : '<span class="chip tag">ระบุเอง</span>';
    html += '<div class="card multi-card"><div><b>'+item.team+'</b> — '+bs.map(b=>b.n).join(' + ')+' '+tag+
      '<div class="sub" style="color:var(--ink-3);font-size:12px">'+item.work_start+' – '+item.work_end+'</div></div>'+
      '<button class="jump" data-jump-a="'+item.branches[0]+'" data-jump-b="'+item.branches[1]+'">→ หาจุดกลางที่เหมาะสม</button></div>';
  });
  box.innerHTML = html;
}
document.getElementById('multi-branch-jobs').addEventListener('click', e=>{
  const btn = e.target.closest('[data-jump-a]');
  if(!btn) return;
  showTab('midpoint');
  setBranchPickerValue('mid-branch-a', btn.dataset.jumpA, true);
  setBranchPickerValue('mid-branch-b', btn.dataset.jumpB, true);
  renderMidpoint();
});

let mapMarkers = [];
function initMap(){
  if(typeof L==='undefined') return;
  if(!mapObj){
    mapObj = L.map('leaflet-map', {scrollWheelZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:18, attribution:'&copy; OpenStreetMap contributors'
    }).addTo(mapObj);
  } else {
    mapMarkers.forEach(m=>mapObj.removeLayer(m));
    mapMarkers = [];
  }
  const bounds = [];
  APPDATA.hotels.forEach(h=>{
    const mk = L.circleMarker([h.la,h.lo], {radius:4, color:'#2F4B9E', weight:1, fillColor:'#8FA6F0', fillOpacity:.55})
      .addTo(mapObj).bindPopup('🏨 <b>'+esc(h.n)+'</b><br>'+esc(h.pv)+' · ฿'+fmtBaht(h.pr)+'/คืน');
    mapMarkers.push(mk);
    bounds.push([h.la,h.lo]);
  });
  const branchScope = scopedBranchSet();
  APPDATA.branches.forEach(b=>{
    if(branchScope && !branchScope.has(b.c)) return;
    const count = APPDATA.hotels.filter(h=>hav(b.la,b.lo,h.la,h.lo)<=15).length;
    const color = count===0 ? '#DC2626' : (count<=2 ? '#F5B700' : '#0D9488');
    const mk = L.circleMarker([b.la,b.lo], {radius:9, color:'#201C1B', weight:1.6, fillColor:color, fillOpacity:.95})
      .addTo(mapObj).bindPopup('📍 <b>'+esc(b.n)+'</b><br>'+esc(b.d)+', '+esc(b.pv)+'<br>ที่พักในระยะ 15 กม.: <b>'+count+'</b> แห่ง');
    mapMarkers.push(mk);
    bounds.push([b.la,b.lo]);
  });
  if(bounds.length) mapObj.fitBounds(bounds,{padding:[24,24]});
}

/* ---------- import panel ---------- */
document.getElementById('import-toggle-btn').addEventListener('click', ()=>{
  document.getElementById('import-panel').classList.toggle('open');
});
function refreshBranchSelects(){
  // เลือกสาขาด้วยตัวเอง (midpoint/emp/import) ใช้ทะเบียนเต็มเสมอ ไม่ผูกกับ scope-toggle —
  // scope มีผลแค่กับมุมมอง "ทุกสาขาตามแผนงาน" ของแท็บ "ที่พักแนะนำตามสาขา" เท่านั้น
  const list = APPDATA.branches;
  setBranchPickerList('mid-branch-a', list);
  setBranchPickerList('mid-branch-b', list);
  setBranchPickerList('emp-branch', list);
  setBranchPickerList('imp-branch', list);
  setBranchPickerList('imp-branch2', list);
  updateNearestBranchPickerList();
}
function updateNearestBranchPickerList(){
  const list = nearestMode==='all' ? scopedBranchList() : APPDATA.branches;
  const labelEl = document.getElementById('nearest-branch-label');
  if(labelEl) labelEl.textContent = nearestMode==='all' ? 'เลือกสาขา (จากแผนงานที่ใช้งานอยู่)' : 'เลือกสาขา (ทั้งทะเบียน)';
  setBranchPickerList('nearest-branch', list);
}
function refreshScheduleViews(){
  renderOverviewKPIs(); renderOverviewTable(); renderMultiBranchJobs(); renderCluster(); renderImportList(); renderArchive();
  refreshBranchSelects();
  initMap();
  renderNearest(); renderMidpoint(); renderEmpCoverage();
}
document.getElementById('scope-toggle').addEventListener('change', refreshScheduleViews);
function renderArchive(){
  const items = archivedScheduleData();
  const box = document.getElementById('archive-body');
  if(items.length===0){
    box.innerHTML = '<div class="banner warn">🟡 ยังไม่มีงานที่จบแล้วในระบบตอนนี้ — งานจะย้ายมาที่นี่เองเมื่อวันจบงานผ่านไปแล้ว</div>';
    return;
  }
  let html = '<table class="dtable"><thead><tr><th>ทีม</th><th>สาขา</th><th>วันทำงาน</th><th></th></tr></thead><tbody>';
  items.forEach(s=>{
    const bnames = s.branches.map(c=>branchByCode[c]?branchByCode[c].n:c).join(' + ');
    html += '<tr><td>'+s.team+'</td><td>'+bnames+'</td><td class="num">'+s.work_start+' – '+s.work_end+'</td>'+
      '<td><button class="btn sm ghost" data-purge="'+s.id+'">🗑️ ลบถาวร</button></td></tr>';
  });
  html += '</tbody></table>';
  box.innerHTML = html;
}
document.getElementById('archive-body').addEventListener('click', async e=>{
  const btn = e.target.closest('[data-purge]');
  if(!btn) return;
  btn.disabled = true;
  const state = await api('/api/schedule/'+encodeURIComponent(btn.dataset.purge), {method:'DELETE'});
  applyState(state);
  refreshScheduleViews();
});

/* ---------- generic helpers for reading uploaded files ---------- */
function normHeader(h){ return String(h).trim().toLowerCase().replace(/[_\s]+/g,''); }
function pick(row, candidates){
  const keys = Object.keys(row);
  for(const cand of candidates){
    const target = normHeader(cand);
    const k = keys.find(k=>normHeader(k)===target);
    if(k!=null && row[k]!=null && row[k]!=='') return row[k];
  }
  return null;
}
function toISODate(v){
  if(v==null || v==='') return null;
  if(v instanceof Date) return v.toISOString().slice(0,10);
  const n = Number(v);
  if(!isNaN(n) && n>20000 && n<80000){
    const d = new Date(Math.round((n-25569)*86400*1000));
    return d.toISOString().slice(0,10);
  }
  const d2 = new Date(v);
  if(!isNaN(d2.getTime())) return d2.toISOString().slice(0,10);
  return null;
}
function readWorkbookFile(file, callback, errCallback){
  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, {type:'array', cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
      callback(rows);
    }catch(err){ errCallback(err); }
  };
  reader.onerror = function(){ errCallback(new Error('อ่านไฟล์ไม่สำเร็จ')); };
  reader.readAsArrayBuffer(file);
}
function mapScheduleRow(row){
  return {
    code: pick(row, ['รหัสสาขา','code','branch_code']),
    team: pick(row, ['ทีมที่ไป','ทีม','team']),
    ws: toISODate(pick(row, ['วันที่เริ่มงาน','work_start','วันเริ่มงาน'])),
    we: toISODate(pick(row, ['วันที่จบงาน','work_end','วันจบงาน'])),
    ci: toISODate(pick(row, ['วันที่เข้างาน','check-in','วันเข้าพัก','checkin'])),
    job_type: pick(row, ['ประเภทงาน','job_type']),
    burmese: pick(row, ['ชาวพม่า','burmese']),
    status: pick(row, ['status','สถานะ']),
  };
}
function buildScheduleRowsForImport(rows){
  let skip=0; const skipCodes=[]; const toInsert=[];
  rows.forEach(row=>{
    const m = mapScheduleRow(row);
    if(m.status && !/confirm/i.test(m.status)){ skip++; skipCodes.push((m.code||'?')+' (สถานะยังไม่ Confirm)'); return; }
    if(!m.code || !branchByCode[m.code]){ skip++; skipCodes.push((m.code||'(ไม่มีรหัส)')+' (ไม่พบในทะเบียนสาขา)'); return; }
    if(!m.team || !m.ws || !m.we){ skip++; skipCodes.push(m.code+' (ข้อมูลไม่ครบ)'); return; }
    toInsert.push({
      team:m.team, branches:[m.code],
      work_start:m.ws, work_end:m.we,
      stay_start:m.ci||m.ws, stay_end:m.we,
      male:null, female:null,
      job_type:m.job_type||null,
      needs_burmese: !!(m.burmese && m.burmese!=='-'),
    });
  });
  return {toInsert, skip, skipCodes};
}
document.getElementById('imp-file').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file) return;
  const resultEl = document.getElementById('imp-file-result');
  readWorkbookFile(file, async rows=>{
    const {toInsert, skip, skipCodes} = buildScheduleRowsForImport(rows);
    const resp = toInsert.length ? await api('/api/schedule/bulk', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({items:toInsert})}) : {ok:0, state:null};
    const ok = resp.ok;
    let msg;
    if(skip>0){
      msg = '<div class="banner warn">⚠️ นำเข้าได้ '+ok+' แถว จากทั้งหมด '+(ok+skip)+' แถวในไฟล์ — ข้าม '+skip+' แถว เพราะรหัสสาขายังไม่อยู่ในทะเบียนสาขาตอนนี้ หรือข้อมูลไม่ครบ'+
        '<br><span class="num" style="font-size:11px">'+skipCodes.slice(0,6).join(' · ')+(skipCodes.length>6?' และอีก '+(skipCodes.length-6)+' รายการ':'')+'</span>'+
        '<br>ถ้ารหัสสาขาถูกต้องแต่ยังไม่พบ ให้อัพโหลดทะเบียนสาขาที่ครบกว่านี้ใน &ldquo;ทะเบียนข้อมูลอ้างอิง&rdquo; ด้านล่างก่อน แล้วค่อยอัพโหลดไฟล์แผนงานซ้ำ</div>';
    } else {
      msg = '<div class="banner" style="background:var(--teal-soft);border-color:var(--teal);color:#0a4f47">✅ นำเข้าสำเร็จทั้งหมด '+ok+' แถว</div>';
    }
    msg += '<div style="color:var(--ink-3);font-size:12px;margin-top:2px">หมายเหตุ: ไฟล์นี้ไม่มีคอลัมน์จำนวนคน (ชาย/หญิง) — กรอกเพิ่มได้ในตาราง &ldquo;แผนงานในระบบตอนนี้&rdquo; ด้านล่าง ก่อนหน้านั้นระบบยังประมาณค่าใช้จ่ายให้ไม่ได้</div>';
    resultEl.innerHTML = msg;
    if(resp.state) applyState(resp.state);
    refreshScheduleViews();
  }, err=>{ resultEl.textContent = '⚠️ อ่านไฟล์ไม่สำเร็จ: '+err.message; });
  e.target.value='';
});
document.getElementById('imp-add-btn').addEventListener('click', async ()=>{
  const team = document.getElementById('imp-team').value.trim();
  const b1 = getBranchPickerValue('imp-branch'), b2 = getBranchPickerValue('imp-branch2');
  const ws = document.getElementById('imp-work-start').value, we = document.getElementById('imp-work-end').value;
  let ss = document.getElementById('imp-stay-start').value || ws;
  let se = document.getElementById('imp-stay-end').value || we;
  const male = Number(document.getElementById('imp-male').value)||0;
  const female = Number(document.getElementById('imp-female').value)||0;
  if(!team || !b1 || !ws || !we){
    document.getElementById('imp-csv-result').textContent = '⚠️ กรอกอย่างน้อย ทีม / สาขา / วันทำงานเริ่ม-จบ ให้ครบก่อน';
    return;
  }
  const branches = b2 ? [b1,b2] : [b1];
  const resp = await api('/api/schedule/bulk', {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({items:[{team, branches, work_start:ws, work_end:we, stay_start:ss, stay_end:se, male, female}]})});
  applyState(resp.state);
  document.getElementById('imp-team').value='';
  refreshScheduleViews();
});
document.getElementById('imp-csv-btn').addEventListener('click', async ()=>{
  const text = document.getElementById('imp-csv-text').value.trim();
  const resultEl = document.getElementById('imp-csv-result');
  if(!text){ resultEl.textContent='วางข้อมูลก่อนกดนำเข้า'; return; }
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const items=[]; let localSkip=0;
  lines.forEach(line=>{
    const parts = line.split(',').map(s=>s.trim());
    if(parts.length<8){localSkip++;return;}
    const [team,code,ws,we,ss,se,male,female] = parts;
    if(!branchByCode[code]){localSkip++;return;}
    items.push({team, branches:[code], work_start:ws, work_end:we, stay_start:ss||ws, stay_end:se||we, male:Number(male)||0, female:Number(female)||0});
  });
  const resp = items.length ? await api('/api/schedule/bulk', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({items})}) : {ok:0, skip:0, state:null};
  document.getElementById('imp-csv-text').value='';
  const totalSkip = localSkip + (resp.skip||0);
  resultEl.textContent = '✅ นำเข้าสำเร็จ '+resp.ok+' แถว'+(totalSkip?(' · ข้าม '+totalSkip+' แถว (รูปแบบไม่ถูกต้อง/รหัสสาขาไม่พบ)'):'');
  if(resp.state) applyState(resp.state);
  refreshScheduleViews();
});
function renderImportList(){
  let html = '<table class="dtable"><thead><tr><th>ทีม</th><th>สาขา</th><th>วันทำงาน</th><th>คน (ช/ญ)</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>';
  scheduleData.forEach(s=>{
    const bnames = s.branches.map(c=>branchByCode[c]?branchByCode[c].n:c).join(' + ');
    const maleVal = s.male==null ? '' : s.male;
    const femaleVal = s.female==null ? '' : s.female;
    const noCount = (s.male==null || s.female==null) ? '<br><span class="chip warn">ไม่ระบุจำนวนคน</span>' : '';
    const tags = [];
    if(s.job_type) tags.push('<span class="chip tag">'+s.job_type+'</span>');
    if(s.needs_burmese) tags.push('<span class="chip tag">ต้องการสื่อพม่า</span>');
    html += '<tr><td>'+s.team+'</td><td>'+bnames+'</td><td class="num">'+s.work_start+' – '+s.work_end+'</td>'+
      '<td><input type="number" min="0" value="'+maleVal+'" placeholder="ช" data-editcount="'+s.id+'" data-field="male" style="width:50px;min-height:30px;padding:2px 5px">'+
      ' / <input type="number" min="0" value="'+femaleVal+'" placeholder="ญ" data-editcount="'+s.id+'" data-field="female" style="width:50px;min-height:30px;padding:2px 5px">'+noCount+'</td>'+
      '<td>'+tags.join(' ')+'</td>'+
      '<td><button class="btn sm ghost" data-del="'+s.id+'">🗑️ ลบ</button></td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('import-list').innerHTML = html;
}
document.getElementById('import-list').addEventListener('change', async e=>{
  const editInp = e.target.closest('[data-editcount]');
  if(!editInp) return;
  const value = editInp.value===''? null : Number(editInp.value);
  const state = await api('/api/schedule/'+encodeURIComponent(editInp.dataset.editcount), {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({field:editInp.dataset.field, value})});
  applyState(state);
  renderOverviewKPIs(); renderOverviewTable(); renderCluster();
});
document.getElementById('import-list').addEventListener('click', async e=>{
  const btn = e.target.closest('[data-del]');
  if(!btn) return;
  btn.disabled = true;
  const state = await api('/api/schedule/'+encodeURIComponent(btn.dataset.del), {method:'DELETE'});
  applyState(state);
  refreshScheduleViews();
});

/* ---------- registry panel (branches / hotels / employees) ---------- */
document.getElementById('registry-toggle-btn').addEventListener('click', ()=>{
  document.getElementById('registry-panel').classList.toggle('open');
});
function rebuildBranchByCode(){
  Object.keys(branchByCode).forEach(k=>delete branchByCode[k]);
  APPDATA.branches.forEach(b=>branchByCode[b.c]=b);
}
function renderRegistryCounts(){
  document.getElementById('reg-branch-count').textContent = APPDATA.branches.length+' แห่ง';
  document.getElementById('reg-hotel-count').textContent = APPDATA.hotels.length+' แห่ง';
  document.getElementById('reg-emp-count').textContent = APPDATA.employees.length+' คน';
}
function fullDataRefresh(){
  refreshMetaCounts();
  renderRegistryCounts();
  refreshBranchSelects();
  initMap();
  renderOverviewKPIs(); renderOverviewTable(); renderMultiBranchJobs(); renderArchive();
  renderNearest(); renderCluster(); renderMidpoint(); renderEmpCoverage();
}
function normalizeBranchRow(row){
  const c = pick(row, ['CJX Store Code','cjx store code','รหัสสาขา','code','c']);
  const n = pick(row, ['ชื่อสาขา','สาขา','name','n']);
  const d = pick(row, ['อำเภอ','district','d']) || '';
  const pv = pick(row, ['จังหวัด','province','pv']) || '';
  const la = Number(pick(row, ['ละติจูด','lat','latitude','la']));
  const lo = Number(pick(row, ['ลองจิจูด','ลองติจูด','lng','lon','longitude','lo']));
  if(!c || !n || isNaN(la) || isNaN(lo)) return null;
  return {c:String(c), n:String(n), d:String(d), pv:String(pv), la, lo};
}
function normalizeHotelRow(row){
  const n = pick(row, ['ชื่อที่พัก','ชื่อ','name','n']);
  const pr = Number(pick(row, ['ราคา','ราคาต่อคืน','price','pr'])) || 0;
  const d = pick(row, ['อำเภอ','district','d']) || '';
  const pv = pick(row, ['จังหวัด','province','pv']) || '';
  const la = Number(pick(row, ['ละติจูด','lat','latitude','la']));
  const lo = Number(pick(row, ['ลองจิจูด','lng','lon','longitude','lo']));
  if(!n || isNaN(la) || isNaN(lo)) return null;
  return {n:String(n), pr, d:String(d), pv:String(pv), la, lo};
}
function cleanVal(v){
  if(v==null) return null;
  const s = String(v).trim();
  if(!s || /^nan$/i.test(s)) return null;
  return s;
}
function parseCoordCell(v){
  const s = cleanVal(v);
  if(!s) return [null,null];
  const parts = s.split(',').map(x=>x.trim());
  if(parts.length<2) return [null,null];
  const la = Number(parts[0]), lo = Number(parts[1]);
  if(isNaN(la)||isNaN(lo)) return [null,null];
  return [la,lo];
}
function normalizeEmployeeRow(row){
  const name = pick(row, ['ชื่อพนักงาน','ชื่อ','name']);
  if(!name) return null;
  const team = cleanVal(pick(row, ['ทีม','รหัสทีม','team','ตำแหน่ง'])) || '';
  const code = cleanVal(pick(row, ['รหัสพนักงาน','employee_id','code']));
  const nickname = cleanVal(pick(row, ['ชื่อเล่น','nickname']));
  const gender = cleanVal(pick(row, ['เพศ','gender']));
  const area_incharge = cleanVal(pick(row, ['Areaดูแล','areaดูแล','area','พื้นที่ดูแล']));
  const phone = cleanVal(pick(row, ['เบอร์โทร','โทร','phone']));
  let home_la=null, home_lo=null;
  const coordCell = pick(row, ['พิกัด','coords','location']);
  if(coordCell!=null){
    [home_la, home_lo] = parseCoordCell(coordCell);
  } else {
    const laRaw = pick(row, ['ละติจูดบ้าน','ละติจูด','lat','home_la']);
    const loRaw = pick(row, ['ลองจิจูดบ้าน','ลองจิจูด','lng','lon','home_lo']);
    if(laRaw!=null){ const n=Number(laRaw); home_la=isNaN(n)?null:n; }
    if(loRaw!=null){ const n=Number(loRaw); home_lo=isNaN(n)?null:n; }
  }
  return {name:String(name), team, code, nickname, gender, area_incharge, phone, home_la, home_lo};
}
function wireRegistryUpload(fileId, resultId, normalizeFn, endpoint, payloadKey){
  document.getElementById(fileId).addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;
    const resultEl = document.getElementById(resultId);
    readWorkbookFile(file, async rows=>{
      const mapped = rows.map(normalizeFn).filter(Boolean);
      const skip = rows.length - mapped.length;
      const state = await api(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({[payloadKey]: mapped})});
      applyState(state);
      resultEl.textContent = '✅ นำเข้า '+mapped.length+' รายการ (แทนที่ชุดเดิม)'+(skip?(' · ข้าม '+skip+' แถว คอลัมน์ไม่ครบ'):'');
      fullDataRefresh();
    }, err=>{ resultEl.textContent = '⚠️ อ่านไฟล์ไม่สำเร็จ: '+err.message; });
    e.target.value='';
  });
}
wireRegistryUpload('reg-branch-file','reg-branch-result', normalizeBranchRow, '/api/branches/replace', 'branches');
wireRegistryUpload('reg-hotel-file','reg-hotel-result', normalizeHotelRow, '/api/hotels/replace', 'hotels');
wireRegistryUpload('reg-emp-file','reg-emp-result', normalizeEmployeeRow, '/api/employees/replace', 'employees');

document.getElementById('rb-add-btn').addEventListener('click', async ()=>{
  const c = document.getElementById('rb-code').value.trim();
  const n = document.getElementById('rb-name').value.trim();
  const d = document.getElementById('rb-district').value.trim();
  const pv = document.getElementById('rb-province').value.trim();
  const la = Number(document.getElementById('rb-lat').value);
  const lo = Number(document.getElementById('rb-lng').value);
  const resultEl = document.getElementById('reg-branch-result');
  if(!c || !n || isNaN(la) || isNaN(lo)){ resultEl.textContent='⚠️ กรอกรหัส/ชื่อ/ละติจูด/ลองจิจูด ให้ครบ'; return; }
  const state = await api('/api/branches/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({branch:{c,n,d,pv,la,lo}})});
  applyState(state);
  ['rb-code','rb-name','rb-district','rb-province','rb-lat','rb-lng'].forEach(id=>document.getElementById(id).value='');
  resultEl.textContent = '✅ เพิ่มสาขา '+n+' แล้ว';
  fullDataRefresh();
});
document.getElementById('rh-add-btn').addEventListener('click', async ()=>{
  const n = document.getElementById('rh-name').value.trim();
  const pr = Number(document.getElementById('rh-price').value)||0;
  const d = document.getElementById('rh-district').value.trim();
  const pv = document.getElementById('rh-province').value.trim();
  const la = Number(document.getElementById('rh-lat').value);
  const lo = Number(document.getElementById('rh-lng').value);
  const resultEl = document.getElementById('reg-hotel-result');
  if(!n || isNaN(la) || isNaN(lo)){ resultEl.textContent='⚠️ กรอกชื่อ/ละติจูด/ลองจิจูด ให้ครบ'; return; }
  const state = await api('/api/hotels/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hotel:{n,pr,d,pv,la,lo}})});
  applyState(state);
  ['rh-name','rh-price','rh-district','rh-province','rh-lat','rh-lng'].forEach(id=>document.getElementById(id).value='');
  resultEl.textContent = '✅ เพิ่มที่พัก '+n+' แล้ว';
  fullDataRefresh();
});
document.getElementById('re-add-btn').addEventListener('click', async ()=>{
  const name = document.getElementById('re-name').value.trim();
  const team = document.getElementById('re-team').value.trim();
  const laV = document.getElementById('re-lat').value, loV = document.getElementById('re-lng').value;
  const resultEl = document.getElementById('reg-emp-result');
  if(!name){ resultEl.textContent='⚠️ กรอกชื่อพนักงานก่อน'; return; }
  const state = await api('/api/employees/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({employee:{name, team, home_la: laV===''?null:Number(laV), home_lo: loV===''?null:Number(loV)}})});
  applyState(state);
  ['re-name','re-team','re-lat','re-lng'].forEach(id=>document.getElementById(id).value='');
  resultEl.textContent = '✅ เพิ่มพนักงาน '+name+' แล้ว';
  fullDataRefresh();
});

/* ================= TAB: nearest ================= */
let nearestMode = 'all';
document.querySelectorAll('#nearest-mode-group button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#nearest-mode-group button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    nearestMode = btn.dataset.val;
    updateNearestBranchPickerList();
    renderNearest();
  });
});
function nearestBranchBlock(b, limit){
  const list = nearestHotels(b.la,b.lo,limit);
  const within15 = APPDATA.hotels.filter(h=>hav(b.la,b.lo,h.la,h.lo)<=15).length;
  const chip = within15===0 ? '<span class="chip danger">⚠️ ไม่มีในระยะ</span>' : (within15<=2 ? '<span class="chip warn">🟡 มีน้อย</span>' : '<span class="chip ok">✅ เพียงพอ</span>');
  let html = '<div class="card"><div class="head"><div class="headline">📍 '+b.n+' <span class="sub" style="color:var(--ink-3);font-weight:400">('+b.d+', '+b.pv+')</span></div>'+chip+'</div>';
  if(within15===0){
    html += '<div class="banner danger">⚠️ ไม่มีที่พักในระยะ 15 กม. จากสาขานี้เลย — ควรหาที่พักเพิ่มเข้าทะเบียนก่อนมีแผนงาน</div>';
  }
  list.forEach((h,i)=>{
    const over = h.dist>15;
    html += '<div class="reco-row"><span>'+(i+1)+'. 🏨 '+h.n+' <span class="sub" style="color:var(--ink-3)">('+h.d+', '+h.pv+')</span></span>'+
      '<span class="num">'+h.dist.toFixed(1)+' กม. · ฿'+fmtBaht(h.pr)+(over?' <span class="chip warn">เกิน 15 กม.</span>':'')+'</span></div>';
  });
  html += '</div>';
  return html;
}
function renderNearest(){
  const box = document.getElementById('nearest-body');
  const b = branchByCode[getBranchPickerValue('nearest-branch')];
  if(!b){
    box.innerHTML = '<div class="banner warn">🟡 '+(nearestMode==='all' ? 'ยังไม่มีสาขาที่มีแผนงานอยู่ — เพิ่ม/อัพโหลดแผนงานก่อน หรือสลับเป็น &ldquo;เลือกสาขาเอง&rdquo;' : 'เลือกสาขาก่อน')+'</div>';
    return;
  }
  box.innerHTML = nearestBranchBlock(b, 10);
}
nearestSel.addEventListener('change', renderNearest);

/* ================= TAB: cluster ================= */
function findClusters(threshold){
  const single = activeScheduleData().filter(s=>s.branches.length===1);
  const out=[];
  for(let i=0;i<single.length;i++){
    for(let j=i+1;j<single.length;j++){
      const A=single[i],B=single[j];
      if(A.team===B.team) continue;
      const bA=branchByCode[A.branches[0]], bB=branchByCode[B.branches[0]];
      if(!bA||!bB) continue;
      const d=hav(bA.la,bA.lo,bB.la,bB.lo);
      if(d<=threshold && overlaps(A.work_start,A.work_end,B.work_start,B.work_end)){
        out.push({A,B,bA,bB,dist:d});
      }
    }
  }
  return out;
}
function renderCluster(){
  const threshold = Number(document.getElementById('cluster-threshold').value);
  const clusters = findClusters(threshold);
  const box = document.getElementById('cluster-body');
  if(clusters.length===0){
    box.innerHTML = '<div class="banner warn">🟡 ยังไม่พบคู่สาขาที่เข้าเกณฑ์ในแผนงานตอนนี้ — ลองปรับเกณฑ์ระยะให้กว้างขึ้น หรือเพิ่มแผนงานในแท็บภาพรวม</div>';
    return;
  }
  let html='';
  clusters.forEach(c=>{
    const soloA = nearestHotels(c.bA.la,c.bA.lo,1)[0];
    const soloB = nearestHotels(c.bB.la,c.bB.lo,1)[0];
    const shared = APPDATA.hotels.map(h=>Object.assign({},h,{dA:hav(c.bA.la,c.bA.lo,h.la,h.lo),dB:hav(c.bB.la,c.bB.lo,h.la,h.lo)}))
      .filter(h=>h.dA<=15&&h.dB<=15).sort((a,b)=>(a.dA+a.dB)-(b.dA+b.dB))[0];
    const roomsA = (c.A.male==null||c.A.female==null) ? null : rooms(c.A.male,c.A.female);
    const roomsB = (c.B.male==null||c.B.female==null) ? null : rooms(c.B.male,c.B.female);
    const nightsA = nightsBetween(c.A.stay_start,c.A.stay_end), nightsB = nightsBetween(c.B.stay_start,c.B.stay_end);
    const costSeparate = (roomsA==null||roomsB==null) ? null : roomsA*soloA.pr*nightsA + roomsB*soloB.pr*nightsB;
    let sharedBlock, diffBlock='';
    if(shared){
      sharedBlock = '<div class="mini-stat"><div class="lbl">ที่พักรวมที่แนะนำ</div><div class="val">🏨 '+shared.n+'</div>'+
        '<div class="sub" style="color:var(--ink-3)">ถึงสาขา 1 '+shared.dA.toFixed(1)+' กม. · ถึงสาขา 2 '+shared.dB.toFixed(1)+' กม. · ฿'+fmtBaht(shared.pr)+'/คืน</div></div>';
      if(costSeparate!=null){
        const costShared = roomsA*shared.pr*nightsA + roomsB*shared.pr*nightsB;
        const diff = costSeparate - costShared;
        diffBlock = '<div class="reco-row"><span>ประมาณการ: จองแยก ฿'+fmtBaht(costSeparate)+' &rarr; จองรวมที่เดียว ฿'+fmtBaht(costShared)+'</span>'+
          '<span class="savings '+(diff>=0?'pos':'neg')+'">'+(diff>=0?'💰 ประหยัด':'เพิ่มขึ้น')+' ฿'+fmtBaht(Math.abs(diff))+'</span></div>';
      } else {
        diffBlock = '<div class="reco-row"><span style="color:var(--ink-3)">ยังไม่ระบุจำนวนคนของทีมใดทีมหนึ่ง — เพิ่มจำนวนคนในตาราง &ldquo;แผนงานในระบบตอนนี้&rdquo; เพื่อให้ประมาณค่าใช้จ่ายได้</span></div>';
      }
    } else {
      sharedBlock = '<div class="mini-stat"><div class="lbl">ที่พักรวม</div><div class="val" style="color:var(--red)">ไม่พบที่พักที่เข้าเกณฑ์ทั้งสองฝั่ง</div></div>';
    }
    html += '<div class="card pop"><div class="multi-card" style="margin-bottom:10px">'+
      '<div><b>'+c.A.team+'</b> @ '+c.bA.n+' ('+c.bA.pv+')  &harr;  <b>'+c.B.team+'</b> @ '+c.bB.n+' ('+c.bB.pv+')'+
      '<div class="sub" style="color:var(--ink-3);font-size:12px">สาขาห่างกัน '+c.dist.toFixed(1)+' กม. · จัดงานวันเดียวกัน '+c.A.work_start+' – '+c.A.work_end+' / '+c.B.work_start+' – '+c.B.work_end+'</div></div>'+
      '<span class="chip ok">🤝 แนะนำรวมที่พัก</span></div>'+
      '<div class="grid2">'+
        '<div class="mini-stat"><div class="lbl">ที่พักเดิม (แยก)</div><div class="val">🏨 '+soloA.n+' / '+soloB.n+'</div>'+
        '<div class="sub" style="color:var(--ink-3)">'+soloA.dist.toFixed(1)+' กม. · '+soloB.dist.toFixed(1)+' กม.</div></div>'+
        sharedBlock+
      '</div>'+diffBlock+
      '</div>';
  });
  box.innerHTML = html;
}
document.getElementById('cluster-threshold').addEventListener('change', renderCluster);

/* ================= TAB: midpoint ================= */
function renderMidpoint(){
  const codeA = getBranchPickerValue('mid-branch-a'), codeB = getBranchPickerValue('mid-branch-b');
  const bA = branchByCode[codeA], bB = branchByCode[codeB];
  const box = document.getElementById('midpoint-body');
  if(!bA || !bB || bA.c===bB.c){
    box.innerHTML = '<div class="banner warn">🟡 เลือกสาขาสองแห่งที่ต่างกัน เพื่อคำนวณจุดกลาง</div>';
    return;
  }
  const weightToggle = document.getElementById('mid-weight-toggle').checked;
  const pA = Number(document.getElementById('mid-people-a').value)||1;
  const pB = Number(document.getElementById('mid-people-b').value)||1;
  const wA = weightToggle ? pA : 1, wB = weightToggle ? pB : 1;

  const scored = APPDATA.hotels.map(h=>{
    const dA=hav(bA.la,bA.lo,h.la,h.lo), dB=hav(bB.la,bB.lo,h.la,h.lo);
    return Object.assign({},h,{dA,dB,score:dA*wA+dB*wB});
  });
  let candidates = scored.filter(h=>h.dA<=15&&h.dB<=15);
  let relaxed=false;
  if(candidates.length===0){candidates=scored; relaxed=true;}
  candidates.sort((a,b)=>a.score-b.score);
  const top = candidates.slice(0,5);

  let html = '<div class="mini-stat" style="margin-bottom:14px;display:inline-block">'+
    '<div class="lbl">ระยะห่างระหว่างสาขา</div><div class="val">'+hav(bA.la,bA.lo,bB.la,bB.lo).toFixed(1)+' กม.</div></div>';
  if(relaxed){
    html += '<div class="banner danger">⚠️ ไม่มีที่พักที่เข้าเกณฑ์ ≤15 กม. จากทั้งสองสาขาพร้อมกัน — แสดงตัวที่ใกล้ที่สุดที่มีแทน (เกินเกณฑ์)</div>';
  }
  html += '<div class="card pop">';
  top.forEach((h,i)=>{
    const rankClass = i===0?'':(i===1?'n2':'n3');
    html += '<div class="reco-row"><span><span class="rank '+rankClass+'">'+(i+1)+'</span>🏨 '+h.n+
      ' <span class="sub" style="color:var(--ink-3)">('+h.pv+') ฿'+fmtBaht(h.pr)+'/คืน</span></span>'+
      '<span class="num">A '+h.dA.toFixed(1)+' กม. + B '+h.dB.toFixed(1)+' กม. = '+h.score.toFixed(1)+'</span></div>';
  });
  html += '</div>';
  box.innerHTML = html;
}
[midA,midB,document.getElementById('mid-weight-toggle'),document.getElementById('mid-people-a'),document.getElementById('mid-people-b')]
  .forEach(el=>el.addEventListener('change',renderMidpoint));

/* ================= TAB: employee home coverage ================= */
let empThreshold = 10;
let empMode = 'all';
document.querySelectorAll('#emp-threshold-group button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#emp-threshold-group button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    empThreshold = Number(btn.dataset.val);
    renderEmpCoverage();
  });
});
document.querySelectorAll('#emp-mode-group button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#emp-mode-group button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    empMode = btn.dataset.val;
    document.getElementById('emp-branch-wrap').style.display = empMode==='one' ? '' : 'none';
    renderEmpCoverage();
  });
});
function empRowFor(e, branches){
  if(e.home_la==null || e.home_lo==null || isNaN(e.home_la) || isNaN(e.home_lo)){
    return {e, d:null, needs:null};
  }
  const d = Math.min(...branches.map(b=>hav(b.la,b.lo,e.home_la,e.home_lo)));
  return {e, d, needs: d>empThreshold};
}
function empSortRows(rows){
  return rows.slice().sort((a,b2)=>{ if(a.d==null) return 1; if(b2.d==null) return -1; return a.d-b2.d; });
}
function empSummaryKPI(rows){
  const noBookingCount = rows.filter(r=>r.needs===false).length;
  const unknownCount = rows.filter(r=>r.d==null).length;
  let html = '<div class="kpi-grid">'+
    '<div class="kpi"><div class="badge violet">👥</div><div><div class="lbl">พนักงานทั้งหมด</div><div class="val">'+rows.length+'</div></div></div>'+
    '<div class="kpi"><div class="badge teal">✅</div><div><div class="lbl">ไม่ต้องจอง</div><div class="val" style="color:var(--teal)">'+noBookingCount+'</div></div></div>'+
    '<div class="kpi"><div class="badge red">🏨</div><div><div class="lbl">ต้องจองที่พัก</div><div class="val">'+(rows.length-noBookingCount-unknownCount)+'</div></div></div></div>';
  if(unknownCount>0){
    html += '<div class="banner warn">🟡 พนักงาน '+unknownCount+' คน ยังไม่มีพิกัดบ้านในทะเบียน — เช็ค &ldquo;บ้านใกล้สาขา&rdquo; ให้ไม่ได้จนกว่าจะเพิ่มพิกัด (ดูแท็บภาพรวม &rarr; ทะเบียนข้อมูลอ้างอิง)</div>';
  }
  return html;
}
function empRowsTable(rows){
  let html = '<table class="dtable"><thead><tr><th>ชื่อ</th><th>ทีม</th><th>ระยะบ้าน &rarr; สาขา</th><th>สถานะ</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const distTxt = r.d==null ? '<span class="sub" style="color:var(--ink-3)">ไม่มีพิกัดบ้าน</span>' : '<span class="num">'+r.d.toFixed(1)+' กม.</span>';
    const statusTxt = r.d==null ? '<span class="chip tag">ไม่ทราบ</span>' : (r.needs?'<span class="chip warn">🏨 ต้องจองที่พัก</span>':'<span class="chip ok">✅ ไม่ต้องจอง</span>');
    html += '<tr><td>'+r.e.name+'</td><td>'+r.e.team+'</td><td>'+distTxt+'</td><td>'+statusTxt+'</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}
function renderEmpCoverage(){
  const box = document.getElementById('emp-body');
  if(empMode==='one'){
    const b = branchByCode[getBranchPickerValue('emp-branch')];
    if(!b){ box.innerHTML=''; return; }
    const rows = empSortRows(APPDATA.employees.map(e=>empRowFor(e,[b])));
    box.innerHTML = empSummaryKPI(rows) + empRowsTable(rows);
    return;
  }
  const items = activeScheduleData();
  if(items.length===0){
    box.innerHTML = '<div class="banner warn">🟡 ยังไม่มีแผนงานที่ใช้งานอยู่ — เพิ่ม/อัพโหลดแผนงานก่อน หรือสลับเป็น &ldquo;เลือกสาขาเอง&rdquo;</div>';
    return;
  }
  let html='';
  items.forEach(item=>{
    const teamEmployees = APPDATA.employees.filter(e=>e.team===item.team);
    const branches = item.branches.map(c=>branchByCode[c]).filter(Boolean);
    if(branches.length===0) return;
    const headline = '<div class="head"><div class="headline">'+item.team+' &rarr; '+branches.map(b=>b.n).join(' + ')+'</div>'+
      '<span class="sub" style="color:var(--ink-3)">'+item.work_start+' – '+item.work_end+'</span></div>';
    if(teamEmployees.length===0){
      html += '<div class="card">'+headline+'<div class="banner warn">🟡 ไม่พบพนักงานในทะเบียนที่ระบุทีม &ldquo;'+item.team+'&rdquo;</div></div>';
      return;
    }
    const rows = empSortRows(teamEmployees.map(e=>empRowFor(e,branches)));
    const noBooking = rows.filter(r=>r.needs===false).length;
    html += '<div class="card">'+headline+
      '<div class="chip '+(noBooking>0?'ok':'tag')+'" style="margin-bottom:8px">'+noBooking+'/'+rows.length+' คน ไม่ต้องจอง</div>';
    rows.forEach(r=>{
      const distTxt = r.d==null ? '<span class="sub" style="color:var(--ink-3)">ไม่มีพิกัดบ้าน</span>' : '<span class="num">'+r.d.toFixed(1)+' กม.</span>';
      const statusTxt = r.d==null ? '<span class="chip tag">ไม่ทราบ</span>' : (r.needs?'<span class="chip warn">🏨 ต้องจอง</span>':'<span class="chip ok">✅ ไม่ต้องจอง</span>');
      html += '<div class="reco-row"><span>'+r.e.name+'</span><span>'+distTxt+' '+statusTxt+'</span></div>';
    });
    html += '</div>';
  });
  box.innerHTML = html || '<div class="banner warn">ไม่พบข้อมูลที่จับคู่ได้ระหว่างแผนงานกับทะเบียนพนักงาน</div>';
}
empSel.addEventListener('change', renderEmpCoverage);

/* ---------- refresh (multi-user sync: manual pull) ---------- */
document.getElementById('refresh-btn').addEventListener('click', async ()=>{
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true; btn.textContent = '⏳ กำลังรีเฟรช…';
  try{
    await loadState();
    refreshMetaCounts(); renderRegistryCounts();
    refreshScheduleViews();
  } finally {
    btn.disabled = false; btn.textContent = '🔄 รีเฟรชข้อมูลล่าสุด';
  }
});

/* ---------- init ---------- */
(async function init(){
  await loadState();
  refreshMetaCounts();
  renderRegistryCounts();
  renderOverviewKPIs();
  renderOverviewTable();
  renderMultiBranchJobs();
  initMap();
  refreshBranchSelects();
  renderNearest();
  renderCluster();
  renderMidpoint();
  renderEmpCoverage();
  renderArchive();
  renderImportList();
  document.getElementById('loading-veil').style.display = 'none';
})();
