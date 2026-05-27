/* ===== Panel de Ventas SAP — Repuestos CTP ===== */
const DATA = window.SAP_DATA || [];
const $ = s => document.querySelector(s);
const C = { amber:'#f59e0b', amber2:'#fb923c', amberD:'#b45309', teal:'#0ea5a4', blue:'#3b6ef5',
            red:'#f43f5e', green:'#10b981', greenD:'#047857', violet:'#7c5cfc',
            mut:'#5a6781', mut2:'#94a0b4', line:'#e6eaf1', surface:'#ffffff' };
const GRP = {1:'Cliente local final', 2:'Cliente local revendedor'};
const DOW = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

/* ---- formatters ---- */
const fUSD = n => '$'+(n||0).toLocaleString('en-US',{maximumFractionDigits:0});
const fUSD2 = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fNum = n => (n||0).toLocaleString('es-PE');
const fPct = n => (n||0).toFixed(1)+'%';
const short = (s,n=34) => s.length>n ? s.slice(0,n-1)+'…' : s;

Chart.defaults.color = C.mut;
Chart.defaults.font.family = "'Manrope',sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.plugins.tooltip.backgroundColor = '#14213d';
Chart.defaults.plugins.tooltip.padding = 11;
Chart.defaults.plugins.tooltip.cornerRadius = 9;
Chart.defaults.plugins.tooltip.titleFont = {weight:'700',size:12};
Chart.defaults.plugins.tooltip.bodyFont = {weight:'600',size:12};

/* ===== STATE ===== */
const ST = { cli:'', ven:'', lf:'', grp:'', doc:'', d1:'', d2:'', trend:'tv',
             sort:{col:'f', dir:-1}, page:1, per:14 };
let charts = {};

/* ===== INIT SELECTS ===== */
function uniq(key){ return [...new Set(DATA.map(r=>r[key]))].sort((a,b)=>(''+a).localeCompare(''+b)); }
function fillSel(id, items, all){
  const el = $(id);
  el.innerHTML = `<option value="">${all}</option>` + items.map(v=>`<option value="${v}">${v}</option>`).join('');
}
(function initFilters(){
  // vendedor: name with key
  const vens = [...new Map(DATA.map(r=>[r.v, r.k])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  $('#fVen').innerHTML = `<option value="">Todos los vendedores</option>` +
    vens.map(([n,k])=>`<option value="${n}">${n} · ${k}</option>`).join('');
  fillSel('#fLf', uniq('lf'), 'Todas las líneas');
  $('#fGrp').innerHTML = `<option value="">Ambos grupos</option><option value="1">${GRP[1]}</option><option value="2">${GRP[2]}</option>`;
  $('#fDoc').innerHTML = `<option value="">Todos los documentos</option><option value="FB">Factura / Boleta</option><option value="NC">Nota de crédito</option>`;
  const fechas = DATA.map(r=>r.f).sort();
  const min=fechas[0], max=fechas[fechas.length-1];
  ['#fD1','#fD2'].forEach(id=>{ $(id).min=min; $(id).max=max; });
})();

/* ===== FILTER ENGINE ===== */
function applyFilters(){
  const q = ST.cli.toLowerCase();
  return DATA.filter(r=>{
    if(ST.ven && r.v!==ST.ven) return false;
    if(ST.lf && r.lf!==ST.lf) return false;
    if(ST.grp && String(r.g)!==ST.grp) return false;
    if(ST.doc && r.doc!==ST.doc) return false;
    if(ST.d1 && r.f<ST.d1) return false;
    if(ST.d2 && r.f>ST.d2) return false;
    if(q && !r.cl.toLowerCase().includes(q)) return false;
    return true;
  });
}

/* ===== AGGREGATIONS ===== */
function sum(rows,k){ return rows.reduce((a,r)=>a+r[k],0); }
function groupAgg(rows, key){
  const m = {};
  rows.forEach(r=>{
    const g = m[r[key]] || (m[r[key]]={venta:0,margen:0,costo:0,trans:0,cant:0});
    g.venta+=r.tv; g.margen+=r.m; g.costo+=r.tc; g.trans++; g.cant+=r.q;
  });
  return m;
}

/* ===== KPIs ===== */
function renderKPIs(rows){
  const venta=sum(rows,'tv'), margen=sum(rows,'m'), costo=sum(rows,'tc');
  const docs = new Set(rows.map(r=>r.nd)).size;
  const clis = new Set(rows.map(r=>r.cl)).size;
  const cant = sum(rows,'q');
  const mPct = venta ? margen/venta*100 : 0;
  const ticket = docs ? venta/docs : 0;
  const k = [
    {l:'Venta total',v:fUSD(venta),s:`${fNum(rows.length)} líneas · ${fNum(cant)} u.`,c:C.amber,bg:'#fff7ea',
      i:'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'},
    {l:'Margen total',v:fUSD(margen),s:`Margen <b>${fPct(mPct)}</b>`,c:C.green,bg:'#e9f9f1',
      i:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'},
    {l:'Costo total',v:fUSD(costo),s:'Costo de mercadería',c:C.red,bg:'#ffe9ec',
      i:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>'},
    {l:'Documentos',v:fNum(docs),s:`Ticket prom. <b>${fUSD2(ticket)}</b>`,c:C.blue,bg:'#eaf1ff',
      i:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'},
    {l:'Clientes activos',v:fNum(clis),s:`${(venta/Math.max(clis,1)).toLocaleString('en-US',{maximumFractionDigits:0,style:'currency',currency:'USD'})} / cliente`,c:C.violet,bg:'#f1ecff',
      i:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>'},
  ];
  $('#kpis').innerHTML = k.map(x=>`
    <div class="kpi" style="--accent:${x.c};--accent-bg:${x.bg}">
      <div class="khead">
        <div class="klbl">${x.l}</div>
        <div class="kico"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${x.i}</svg></div>
      </div>
      <div class="kval">${x.v}</div>
      <div class="ksub">${x.s}</div>
    </div>`).join('');
}

/* ===== CHARTS ===== */
function mk(id, cfg){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),cfg); }
const gridOpt = {grid:{color:C.line,drawTicks:false},border:{display:false}};
const noGrid = {grid:{display:false},border:{display:false}};

function renderTrend(rows){
  const m={};
  rows.forEach(r=>{ const g=m[r.f]||(m[r.f]={tv:0,m:0,tr:0}); g.tv+=r.tv; g.m+=r.m; g.tr++; });
  const days = Object.keys(m).sort();
  const lbls = days.map(d=>d.slice(8)+'/'+d.slice(5,7));
  const mode = ST.trend;
  const vals = days.map(d=> mode==='tr'? m[d].tr : m[d][mode]);
  const col = mode==='m'?C.green: mode==='tr'?C.blue: C.amber;
  mk('#cTrend',{type:'line',data:{labels:lbls,datasets:[{data:vals,
    borderColor:col,borderWidth:2.5,tension:.35,fill:true,pointRadius:3,pointHoverRadius:6,
    pointBackgroundColor:col,pointBorderColor:'#ffffff',pointBorderWidth:2,
    backgroundColor:ctx=>{const c=ctx.chart.ctx.createLinearGradient(0,0,0,340);c.addColorStop(0,col+'33');c.addColorStop(1,col+'04');return c;}}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>mode==='tr'?fNum(c.parsed.y)+' transacciones':fUSD2(c.parsed.y)}}},
      scales:{x:{...noGrid,ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:12}},
        y:{...gridOpt,ticks:{callback:v=>mode==='tr'?v:'$'+(v/1000).toFixed(0)+'k'}}}}});
}

function renderGroup(rows){
  const m=groupAgg(rows,'g');
  const ids=[1,2].filter(i=>m[i]);
  mk('#cGroup',{type:'doughnut',data:{labels:ids.map(i=>GRP[i]),
    datasets:[{data:ids.map(i=>m[i].venta),backgroundColor:[C.blue,C.violet],
      borderColor:'#ffffff',borderWidth:3,hoverOffset:6}]},
    options:{maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{padding:14,boxWidth:10,boxHeight:10,usePointStyle:true,font:{size:12,weight:'600'}}},
        tooltip:{callbacks:{label:c=>{const t=c.dataset.data.reduce((a,b)=>a+b,0);return ` ${fUSD2(c.parsed)} · ${(c.parsed/t*100).toFixed(1)}%`;}}}}}});
}

function renderVen(rows){
  const m=groupAgg(rows,'v');
  const arr=Object.entries(m).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
  const lbl=arr.map(x=> x.k.split(' ')[0]+' '+(x.k.split(' ')[1]||'').slice(0,1)+'.');
  mk('#cVen',{type:'bar',data:{labels:lbl,datasets:[
    {label:'Venta',data:arr.map(x=>x.venta),backgroundColor:C.amber,borderRadius:5,maxBarThickness:30},
    {label:'Margen',data:arr.map(x=>x.margen),backgroundColor:C.green,borderRadius:5,maxBarThickness:30}]},
    options:{maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,boxHeight:10,usePointStyle:true,padding:12}},
      tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${fUSD2(c.parsed.y)}`,
        afterBody:items=>{const i=items[0].dataIndex;return 'Margen '+fPct(arr[i].margen/arr[i].venta*100);}}}},
      scales:{x:{...noGrid,ticks:{font:{size:10}}},y:{...gridOpt,ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}}}}});
}

function renderLf(rows){
  const m=groupAgg(rows,'lf');
  const arr=Object.entries(m).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta).slice(0,12).reverse();
  mk('#cLf',{type:'bar',data:{labels:arr.map(x=>x.k),datasets:[{data:arr.map(x=>x.venta),
    backgroundColor:ctx=>{const g=ctx.chart.ctx.createLinearGradient(0,0,600,0);g.addColorStop(0,C.amber2);g.addColorStop(1,C.amber);return g;},
    borderRadius:5,maxBarThickness:22}]},
    options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>` ${fUSD2(c.parsed.x)}`,afterLabel:c=>{const x=arr[c.dataIndex];return `Margen ${fPct(x.margen/x.venta*100)} · ${x.trans} trans.`;}}}},
      scales:{x:{...gridOpt,ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}},y:{...noGrid,ticks:{font:{size:11,weight:'600'}}}}}});
}

function renderScatter(rows){
  const m=groupAgg(rows,'lf');
  const arr=Object.entries(m).map(([k,v])=>({k,...v})).filter(x=>x.venta>200);
  const maxV=Math.max(...arr.map(x=>x.venta));
  mk('#cScatter',{type:'bubble',data:{datasets:[{
    data:arr.map(x=>({x:x.venta,y:x.venta?x.margen/x.venta*100:0,r:6+Math.sqrt(x.venta/maxV)*26,lbl:x.k})),
    backgroundColor:C.teal+'40',borderColor:C.teal,borderWidth:1.5}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>{const d=c.raw;return [d.lbl,`Venta ${fUSD(d.x)} · Margen ${d.y.toFixed(1)}%`];}}}},
      scales:{x:{...gridOpt,type:'logarithmic',title:{display:true,text:'Venta US$ (log)',color:C.mut,font:{size:10}},ticks:{callback:v=>'$'+(v>=1000?(v/1000)+'k':v)}},
        y:{...gridOpt,title:{display:true,text:'Margen %',color:C.mut,font:{size:10}},ticks:{callback:v=>v+'%'}}}}});
}

function renderDow(rows){
  const m=[0,0,0,0,0,0,0];
  rows.forEach(r=>{ const d=new Date(r.f+'T00:00:00').getDay(); m[d]+=r.tv; });
  const order=[1,2,3,4,5,6,0];
  mk('#cDow',{type:'bar',data:{labels:order.map(i=>DOW[i].slice(0,3)),
    datasets:[{data:order.map(i=>m[i]),backgroundColor:order.map(i=> i===0?'#d3dae5':C.blue),borderRadius:6,maxBarThickness:42}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{title:items=>DOW[order[items[0].dataIndex]],label:c=>' '+fUSD2(c.parsed.y)}}},
      scales:{x:{...noGrid,ticks:{font:{weight:'600'}}},y:{...gridOpt,ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}}}}});
}

/* ===== RANK TABLES ===== */
function renderRank(rows){
  // clientes
  const mc=groupAgg(rows,'cl');
  const ac=Object.entries(mc).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta).slice(0,10);
  $('#tCli').innerHTML = `<thead><tr><th>Cliente</th><th class="num">Venta</th><th class="num">Margen %</th></tr></thead><tbody>`+
    ac.map((x,i)=>`<tr><td><div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span>${short(x.k,28)}</div></td>
      <td class="num">${fUSD(x.venta)}</td><td class="num ${x.margen>=0?'pos':'neg'}">${fPct(x.venta?x.margen/x.venta*100:0)}</td></tr>`).join('')+`</tbody>`;
  // skus
  const ms={};
  rows.forEach(r=>{ const g=ms[r.sku]||(ms[r.sku]={d:r.d,venta:0,cant:0}); g.venta+=r.tv; g.cant+=r.q; });
  const as=Object.entries(ms).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta).slice(0,10);
  $('#tSku').innerHTML = `<thead><tr><th>SKU · Descripción</th><th class="num">Venta</th><th class="num">Unid.</th></tr></thead><tbody>`+
    as.map((x,i)=>`<tr><td><div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span><span><b style="font-family:'Spline Sans Mono';font-size:11px;color:var(--mut)">${x.k}</b> ${short(x.d,22)}</span></div></td>
      <td class="num">${fUSD(x.venta)}</td><td class="num">${fNum(x.cant)}</td></tr>`).join('')+`</tbody>`;
}

/* ===== DETAIL TABLE ===== */
let curRows=[];
const COLS=[
  {k:'f',l:'Fecha'},{k:'nd',l:'Documento'},{k:'cl',l:'Cliente'},{k:'v',l:'Vendedor'},
  {k:'lf',l:'Línea'},{k:'d',l:'SKU'},{k:'q',l:'Cant',n:1},{k:'tv',l:'Venta',n:1},
  {k:'m',l:'Margen',n:1},{k:'pct',l:'Mg%',n:1}
];
function renderDetail(rows){
  curRows = rows.slice().sort((a,b)=>{
    let A=a[ST.sort.col], B=b[ST.sort.col];
    if(ST.sort.col==='pct'){A=a.tv?a.m/a.tv:0;B=b.tv?b.m/b.tv:0;}
    if(typeof A==='string') return ST.sort.dir*A.localeCompare(B);
    return ST.sort.dir*(A-B);
  });
  $('#tblCount').textContent = fNum(rows.length)+' líneas';
  const pages = Math.max(1, Math.ceil(curRows.length/ST.per));
  if(ST.page>pages) ST.page=pages;
  const start=(ST.page-1)*ST.per;
  const slice=curRows.slice(start,start+ST.per);
  const head = COLS.map(c=>{
    const ar = ST.sort.col===c.k ? (ST.sort.dir<0?' ↓':' ↑') : '';
    return `<th data-c="${c.k}" class="${c.n?'num':''}">${c.l}<span class="ar">${ar}</span></th>`;
  }).join('');
  const body = slice.length ? slice.map(r=>{
    const pct=r.tv?r.m/r.tv*100:0;
    return `<tr>
      <td class="num" style="color:var(--mut)">${r.f.slice(8)}/${r.f.slice(5,7)}</td>
      <td><span style="font-family:'Spline Sans Mono';font-size:11px">${r.nd}</span> ${r.doc==='NC'?'<span class="pill nc">NC</span>':''}</td>
      <td>${short(r.cl,30)}</td>
      <td style="color:var(--mut)">${r.k}</td>
      <td><span class="pill g${r.g}">${r.lf}</span></td>
      <td><b style="font-family:'Spline Sans Mono';font-size:11px;color:var(--mut)">${r.sku}</b> ${short(r.d,18)}</td>
      <td class="num">${fNum(r.q)}</td>
      <td class="num">${fUSD2(r.tv)}</td>
      <td class="num ${r.m>=0?'pos':'neg'}">${fUSD2(r.m)}</td>
      <td class="num ${pct>=0?'pos':'neg'}">${pct.toFixed(0)}%</td>
    </tr>`;}).join('') : `<tr><td colspan="10"><div class="empty">Sin resultados para los filtros seleccionados</div></td></tr>`;
  $('#tDet').innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  $('#tblInfo').textContent = curRows.length ? `Mostrando ${start+1}–${Math.min(start+ST.per,curRows.length)} de ${fNum(curRows.length)}` : '0 resultados';
  $('#pgLbl').textContent = `${ST.page} / ${pages}`;
  $('#pgPrev').disabled = ST.page<=1;
  $('#pgNext').disabled = ST.page>=pages;
  $('#tDet').querySelectorAll('th').forEach(th=>th.onclick=()=>{
    const c=th.dataset.c;
    if(ST.sort.col===c) ST.sort.dir*=-1; else {ST.sort.col=c;ST.sort.dir=-1;}
    renderDetail(curRows.length?rows:rows);
  });
}

/* ===== CHIPS ===== */
function renderChips(){
  const items=[];
  if(ST.cli) items.push(['cli','Cliente',ST.cli]);
  if(ST.ven) items.push(['ven','Vendedor',ST.ven.split(' ')[0]+' '+(ST.ven.split(' ')[1]||'')]);
  if(ST.lf) items.push(['lf','Línea',ST.lf]);
  if(ST.grp) items.push(['grp','Grupo',GRP[ST.grp]]);
  if(ST.doc) items.push(['doc','Doc',ST.doc==='FB'?'Factura/Boleta':'Nota crédito']);
  if(ST.d1) items.push(['d1','Desde',ST.d1]);
  if(ST.d2) items.push(['d2','Hasta',ST.d2]);
  $('#chips').innerHTML = items.length ? items.map(([k,l,v])=>
    `<span class="chip" data-k="${k}"><b>${l}:</b> ${short(v,24)} <span class="x">×</span></span>`).join('')
    : '<span style="color:var(--mut2);font-size:12px;font-weight:600">Sin filtros activos · mostrando todo el periodo</span>';
  $('#chips').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{
    const k=c.dataset.k; ST[k]='';
    const map={cli:'#fCli',ven:'#fVen',lf:'#fLf',grp:'#fGrp',doc:'#fDoc',d1:'#fD1',d2:'#fD2'};
    $(map[k]).value=''; ST.page=1; render();
  });
}

/* ===== MAIN RENDER ===== */
function render(){
  const rows = applyFilters();
  renderChips();
  renderKPIs(rows);
  renderTrend(rows);
  renderGroup(rows);
  renderVen(rows);
  renderLf(rows);
  renderScatter(rows);
  renderDow(rows);
  renderRank(rows);
  renderDetail(rows);
}

/* ===== EVENTS ===== */
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
$('#fCli').addEventListener('input', debounce(e=>{ST.cli=e.target.value;ST.page=1;render();},220));
$('#fVen').addEventListener('change',e=>{ST.ven=e.target.value;ST.page=1;render();});
$('#fLf').addEventListener('change',e=>{ST.lf=e.target.value;ST.page=1;render();});
$('#fGrp').addEventListener('change',e=>{ST.grp=e.target.value;ST.page=1;render();});
$('#fDoc').addEventListener('change',e=>{ST.doc=e.target.value;ST.page=1;render();});
$('#fD1').addEventListener('change',e=>{ST.d1=e.target.value;ST.page=1;render();});
$('#fD2').addEventListener('change',e=>{ST.d2=e.target.value;ST.page=1;render();});
$('#resetBtn').onclick=()=>{
  Object.assign(ST,{cli:'',ven:'',lf:'',grp:'',doc:'',d1:'',d2:'',page:1});
  ['#fCli','#fVen','#fLf','#fGrp','#fDoc','#fD1','#fD2'].forEach(id=>$(id).value='');
  render();
};
$('#trendSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  $('#trendSeg').querySelectorAll('button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); ST.trend=b.dataset.m; renderTrend(applyFilters());
});
$('#pgPrev').onclick=()=>{if(ST.page>1){ST.page--;renderDetail(applyFilters());}};
$('#pgNext').onclick=()=>{ST.page++;renderDetail(applyFilters());};

/* ===== GO ===== */
render();
