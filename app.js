/* =====================================================================
   Panel de Ventas SAP — Repuestos CTP
   Creado por: ALEXIS RAMIREZ  ·  alias: SHAKDOWS
   © 2026 Alexis Ramírez (Shakdows). Diseño y desarrollo originales.
   ===================================================================== */
let DATA = window.SAP_DATA || [];
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
const fAx = v => Math.abs(v)>=1000 ? '$'+(v/1000).toFixed(Math.abs(v)%1000?1:0)+'k' : '$'+Math.round(v);

Chart.defaults.color = C.mut;
Chart.defaults.font.family = "'Manrope',sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.plugins.tooltip.backgroundColor = '#14213d';
Chart.defaults.plugins.tooltip.padding = 11;
Chart.defaults.plugins.tooltip.cornerRadius = 9;
Chart.defaults.plugins.tooltip.titleFont = {weight:'700',size:12};
Chart.defaults.plugins.tooltip.bodyFont = {weight:'600',size:12};

/* ===== STATE ===== */
const ST = { cli:'', ven:'', lf:'', grp:'', doc:'', d1:'', d2:'', trend:'tv', gran:'d',
             sort:{col:'f', dir:-1}, page:1, per:14 };
let charts = {};
let INS_ROWS = [];
let modalChart = null;

/* ===== INIT SELECTS ===== */
function uniq(key){ return [...new Set(DATA.map(r=>r[key]))].sort((a,b)=>(''+a).localeCompare(''+b)); }
function fillSel(id, items, all){
  const el = $(id);
  el.innerHTML = `<option value="">${all}</option>` + items.map(v=>`<option value="${v}">${v}</option>`).join('');
}
function buildSelectors(){
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
  // etiqueta de periodo en header
  if(min&&max){ const fmt=d=>d.slice(8)+' '+['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+d.slice(5,7)-1];
    $('#periodLbl').textContent = `${fmt(min)} — ${fmt(max)} ${max.slice(0,4)}`; }
}

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
// filtro que respeta todo MENOS el rango de fecha global (para el comparador)
function filterNonDate(){
  const q = ST.cli.toLowerCase();
  return DATA.filter(r=>{
    if(ST.ven && r.v!==ST.ven) return false;
    if(ST.lf && r.lf!==ST.lf) return false;
    if(ST.grp && String(r.g)!==ST.grp) return false;
    if(ST.doc && r.doc!==ST.doc) return false;
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

/* ===== TIME BUCKETING ===== */
function mondayOf(dStr){
  const d=new Date(dStr+'T00:00:00'); const wd=(d.getDay()+6)%7; // 0=Lun
  d.setDate(d.getDate()-wd); return d.toISOString().slice(0,10);
}
const MES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function bucketTime(rows, gran){
  const m={};
  rows.forEach(r=>{
    let key,lbl;
    if(gran==='w'){ key=mondayOf(r.f); const e=new Date(key+'T00:00:00'); e.setDate(e.getDate()+6);
      lbl=key.slice(8)+'–'+String(e.getDate()).padStart(2,'0')+' '+MES[e.getMonth()]; }
    else if(gran==='mo'){ key=r.f.slice(0,7); lbl=MES[+r.f.slice(5,7)-1]+' '+r.f.slice(0,4); }
    else { key=r.f; lbl=r.f.slice(8)+'/'+r.f.slice(5,7); }
    const g=m[key]||(m[key]={lbl,tv:0,m:0,tr:0}); g.tv+=r.tv; g.m+=r.m; g.tr++;
  });
  const keys=Object.keys(m).sort();
  return {keys, labels:keys.map(k=>m[k].lbl), data:keys.map(k=>m[k])};
}

function renderTrend(rows){
  const gran=ST.gran, mode=ST.trend;
  const {labels,data}=bucketTime(rows,gran);
  const vals=data.map(d=> mode==='tr'?d.tr:d[mode]);
  const col = mode==='m'?C.green: mode==='tr'?C.blue: C.amber;
  const asBar = gran!=='d';
  const ds = asBar
    ? {data:vals,backgroundColor:ctx=>{const c=ctx.chart.ctx.createLinearGradient(0,0,0,340);c.addColorStop(0,col);c.addColorStop(1,col+'aa');return c;},
        borderRadius:7,maxBarThickness:64,hoverBackgroundColor:col}
    : {data:vals,borderColor:col,borderWidth:2.5,tension:.35,fill:true,pointRadius:3,pointHoverRadius:6,
        pointBackgroundColor:col,pointBorderColor:'#fff',pointBorderWidth:2,
        backgroundColor:ctx=>{const c=ctx.chart.ctx.createLinearGradient(0,0,0,340);c.addColorStop(0,col+'33');c.addColorStop(1,col+'04');return c;}};
  mk('#cTrend',{type:asBar?'bar':'line',data:{labels,datasets:[ds]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{title:items=>items[0].label,
        label:c=>{const d=data[c.dataIndex];return [
          ' Venta: '+fUSD2(d.tv),' Margen: '+fUSD2(d.m)+'  ('+fPct(d.tv?d.m/d.tv*100:0)+')',
          ' Transacciones: '+fNum(d.tr)];}}}},
      scales:{x:{...noGrid,ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:12}},
        y:{...gridOpt,beginAtZero:true,ticks:{callback:v=>mode==='tr'?v:'$'+(v/1000).toFixed(0)+'k'}}}}});
}

/* ===== VENTA ACUMULADA ===== */
function renderCumul(rows){
  const {labels,data}=bucketTime(rows,'d');
  let av=0,am=0; const cv=[],cm=[];
  data.forEach(d=>{av+=d.tv;am+=d.m;cv.push(+av.toFixed(2));cm.push(+am.toFixed(2));});
  mk('#cCumul',{type:'line',data:{labels,datasets:[
    {label:'Venta acum.',data:cv,borderColor:C.amber,borderWidth:2.5,tension:.3,fill:true,pointRadius:0,pointHoverRadius:5,
      backgroundColor:ctx=>{const c=ctx.chart.ctx.createLinearGradient(0,0,0,300);c.addColorStop(0,C.amber+'2e');c.addColorStop(1,C.amber+'03');return c;}},
    {label:'Margen acum.',data:cm,borderColor:C.green,borderWidth:2.5,tension:.3,fill:false,pointRadius:0,pointHoverRadius:5,borderDash:[5,4]}]},
    options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,boxHeight:10,usePointStyle:true,padding:12}},
        tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${fUSD2(c.parsed.y)}`}}},
      scales:{x:{...noGrid,ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:10}},
        y:{...gridOpt,beginAtZero:true,ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}}}}});
}

/* ===== MAPA DE CALOR DIARIO ===== */
function renderHeat(rows){
  const by={};
  rows.forEach(r=>{ by[r.f]=(by[r.f]||0)+r.tv; });
  const allDates=Object.keys(by).sort();
  if(!allDates.length){ $('#heatWrap').innerHTML='<div class="empty">Sin datos para los filtros seleccionados</div>'; return; }
  const start=mondayOf(allDates[0]), lastMon=mondayOf(allDates[allDates.length-1]);
  const weeks=[]; let cur=new Date(start+'T00:00:00'); const end=new Date(lastMon+'T00:00:00');
  while(cur<=end){ weeks.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+7); }
  const max=Math.max(...Object.values(by));
  const DOWS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const tone=v=>{ const t=v/max, a=0.14+t*0.86; return {bg:`rgba(245,158,11,${a.toFixed(2)})`, c:t>0.5?'#fff':'var(--amber-d)'}; };
  let html='<div class="heat-grid"><div></div>'+DOWS.map(d=>`<div class="heat-dow">${d}</div>`).join('');
  weeks.forEach(wk=>{
    const wd=new Date(wk+'T00:00:00');
    html+=`<div class="heat-wk">${String(wd.getDate()).padStart(2,'0')}/${String(wd.getMonth()+1).padStart(2,'0')}</div>`;
    for(let i=0;i<7;i++){
      const dt=new Date(wk+'T00:00:00'); dt.setDate(dt.getDate()+i);
      const ds=dt.toISOString().slice(0,10), v=by[ds]||0;
      if(v>0){ const t=tone(v);
        html+=`<div class="heat-cell has" style="background:${t.bg};color:${t.c}" data-d="${ds}" data-v="${v}"><span class="dn">${dt.getDate()}</span>${v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</div>`;
      } else {
        const inR = ds>=allDates[0] && ds<=allDates[allDates.length-1];
        html+=`<div class="heat-cell ${inR?'':'empty'}"><span class="dn">${inR?dt.getDate():''}</span></div>`;
      }
    }
  });
  html+='</div><div class="heat-scale">Menos <span class="sw" style="background:var(--surface2)"></span><span class="sw" style="background:rgba(245,158,11,.3)"></span><span class="sw" style="background:rgba(245,158,11,.6)"></span><span class="sw" style="background:rgba(245,158,11,1)"></span> Más</div>';
  const w=$('#heatWrap'); w.innerHTML=html;
  let tip=document.querySelector('.heat-tip');
  if(!tip){ tip=document.createElement('div'); tip.className='heat-tip'; document.body.appendChild(tip); }
  w.querySelectorAll('.heat-cell.has').forEach(c=>{
    c.addEventListener('mousemove',e=>{
      const d=new Date(c.dataset.d+'T00:00:00');
      tip.innerHTML=`${DOW[d.getDay()]} ${c.dataset.d.slice(8)}/${c.dataset.d.slice(5,7)} · <b>${fUSD2(+c.dataset.v)}</b>`;
      tip.style.opacity=1; tip.style.left=Math.min(e.clientX+12,window.innerWidth-160)+'px'; tip.style.top=(e.clientY-12)+'px';
    });
    c.addEventListener('mouseleave',()=>tip.style.opacity=0);
  });
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
    {label:'Venta',data:arr.map(x=>x.venta),backgroundColor:ctx=>{const c=ctx.chart.ctx.createLinearGradient(0,0,0,340);c.addColorStop(0,C.amber);c.addColorStop(1,C.amber+'b0');return c;},borderRadius:6,maxBarThickness:34,order:2,yAxisID:'y'},
    {label:'Margen',data:arr.map(x=>x.margen),backgroundColor:C.green,borderRadius:6,maxBarThickness:34,order:3,yAxisID:'y'},
    {label:'Margen %',data:arr.map(x=>x.venta?+(x.margen/x.venta*100).toFixed(1):0),type:'line',
      borderColor:C.violet,borderWidth:2.5,tension:.35,pointRadius:3.5,pointBackgroundColor:C.violet,pointBorderColor:'#fff',pointBorderWidth:1.5,
      order:1,yAxisID:'y1'}]},
    options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,boxHeight:10,usePointStyle:true,padding:12}},
      tooltip:{callbacks:{label:c=>c.dataset.label==='Margen %'?` Margen %: ${c.parsed.y}%`:` ${c.dataset.label}: ${fUSD2(c.parsed.y)}`}}},
      scales:{x:{...noGrid,ticks:{font:{size:10}}},
        y:{...gridOpt,beginAtZero:true,position:'left',ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}},
        y1:{position:'right',beginAtZero:true,grid:{display:false},border:{display:false},ticks:{callback:v=>v+'%',color:C.violet,font:{weight:'600'}}}}}});
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

/* ===== EXPORTAR CSV ===== */
function exportCSV(){
  const rows = applyFilters();
  const cols = ['Fecha','Documento','N° Documento','Cliente','Grupo','Vendedor','Key','Línea/Familia','SKU','Descripción','Cantidad','Total Venta US$','Total Costo US$','Margen US$','Margen %'];
  const esc = v => { v = v==null?'':String(v); return /[",;\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const lines = [cols.join(';')];
  rows.forEach(r=>{
    const pct = r.tv ? (r.m/r.tv*100).toFixed(1) : '0';
    lines.push([r.f, r.doc==='NC'?'Nota de Crédito':'Factura/Boleta', r.nd, r.cl, GRP[r.g], r.v, r.k, r.lf, r.sku, r.d, r.q, r.tv, r.tc, r.m, pct].map(esc).join(';'));
  });
  const blob = new Blob(['\ufeff'+lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href=url; a.download=`ventas_CTP_${rows.length}reg_${stamp}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ===== ANALISTA AUTOMATICO ===== */
const ICO = {
  up:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  warn:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  alert:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  pkg:'<path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  pct:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'
};
function renderInsights(rows){
  const grid = $('#insGrid');
  if(!rows.length){ grid.innerHTML='<div class="empty" style="grid-column:1/-1">Sin datos para los filtros seleccionados</div>'; return; }
  INS_ROWS = rows;
  const out=[];
  const venta=sum(rows,'tv'), margen=sum(rows,'m');
  const mPct = venta?margen/venta*100:0;

  // 1) Concentración de vendedores (riesgo)
  const vAgg=Object.entries(groupAgg(rows,'v')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
  if(vAgg.length>1){
    const top=vAgg[0], share=top.venta/venta*100;
    out.push({t:share>=33?'warn':'info',ic:share>=33?'warn':'users',type:'ven',
      h:`<b>${top.k.split(' ').slice(0,2).join(' ')}</b> concentra el <span class="big">${share.toFixed(0)}%</span> de la venta`,
      d: share>=33?'Dependencia alta de un solo vendedor: conviene diversificar la cartera.':'Reparto razonable entre el equipo.'});
  }
  // 2) Concentración de clientes (Pareto)
  const cAgg=Object.entries(groupAgg(rows,'cl')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
  let acc=0, n80=0; for(const c of cAgg){ acc+=c.venta; n80++; if(acc>=venta*0.8) break; }
  const pctCli = (n80/cAgg.length*100);
  out.push({t:'info',ic:'pct',type:'pareto',
    h:`El <span class="big">80%</span> de la venta viene de <b>${n80} clientes</b>`,
    d:`Solo el ${pctCli.toFixed(0)}% de los ${fNum(cAgg.length)} clientes activos. Principio de Pareto en acción — prioriza su fidelización.`});
  // 3) Cliente top
  out.push({t:'star',ic:'star',type:'cli',param:cAgg[0].k,
    h:`Cliente #1: <b>${cAgg[0].k.length>26?cAgg[0].k.slice(0,25)+'…':cAgg[0].k}</b>`,
    d:`<span class="big">${fUSD(cAgg[0].venta)}</span> · ${(cAgg[0].venta/venta*100).toFixed(1)}% del total · margen ${fPct(cAgg[0].venta?cAgg[0].margen/cAgg[0].venta*100:0)}.`});
  // 4) Clientes a pérdida / margen negativo
  const loss=cAgg.filter(c=>c.margen<0);
  if(loss.length){
    const lossSum=loss.reduce((a,c)=>a+c.margen,0);
    out.push({t:'alert',ic:'alert',type:'loss',
      h:`<b>${loss.length} cliente${loss.length>1?'s':''}</b> con margen negativo`,
      d:`Ventas que dejaron pérdida (<span class="big">${fUSD2(lossSum)}</span> en conjunto). Revisa precios o devoluciones de: ${loss.slice(0,2).map(c=>c.k.split(' ')[0]).join(', ')}${loss.length>2?'…':''}.`});
  }
  // 5) Familia: mejor margen vs peor margen (entre relevantes)
  const lAgg=Object.entries(groupAgg(rows,'lf')).map(([k,v])=>({k,...v,mp:v.venta?v.margen/v.venta*100:0})).filter(x=>x.venta>venta*0.01).sort((a,b)=>b.venta-a.venta);
  if(lAgg.length>2){
    const best=[...lAgg].sort((a,b)=>b.mp-a.mp)[0];
    const worst=[...lAgg].sort((a,b)=>a.mp-b.mp)[0];
    out.push({t:'good',ic:'up',type:'fam',param:best.k,
      h:`<b>${best.k}</b> es la familia más rentable: <span class="big">${best.mp.toFixed(0)}%</span>`,
      d:`Frente a un promedio de ${mPct.toFixed(0)}%. Empujar su venta mejora el margen global.`});
    if(worst.k!==best.k && worst.mp < mPct*0.7){
      out.push({t:'warn',ic:'pkg',type:'fam',param:worst.k,
        h:`<b>${worst.k}</b> vende bien pero su margen es bajo: <span class="big">${worst.mp.toFixed(0)}%</span>`,
        d:`Mucho volumen (${fUSD(worst.venta)}) con poca rentabilidad. Oportunidad para renegociar costo o precio.`});
    }
  }
  // 6) Mejor / peor día
  const dAgg={}; rows.forEach(r=>{const x=dAgg[r.f]||(dAgg[r.f]={tv:0,m:0}); x.tv+=r.tv; x.m+=r.m;});
  const dArr=Object.entries(dAgg).sort((a,b)=>b[1].tv-a[1].tv);
  if(dArr.length>1){
    const bd=dArr[0]; const dt=new Date(bd[0]+'T00:00:00');
    out.push({t:'info',ic:'cal',type:'day',param:bd[0],
      h:`Mejor día por venta: <b>${DOW[dt.getDay()]} ${bd[0].slice(8)}/${bd[0].slice(5,7)}</b>`,
      d:`<span class="big">${fUSD(bd[1].tv)}</span> en ventas — ${(bd[1].tv/venta*100).toFixed(0)}% de todo el periodo en un solo día.`});
  }
  // 6b) Mejor día POR MARGEN
  const dMArr=Object.entries(dAgg).filter(([,v])=>v.m>0).sort((a,b)=>b[1].m-a[1].m);
  if(dMArr.length>1){
    const bm=dMArr[0]; const dtm=new Date(bm[0]+'T00:00:00');
    const mp = bm[1].tv ? bm[1].m/bm[1].tv*100 : 0;
    // si coincide con el mejor por venta, mostrar igualmente pero con foco en margen
    out.push({t:'good',ic:'up',type:'day',param:bm[0],
      h:`Mejor día por margen: <b>${DOW[dtm.getDay()]} ${bm[0].slice(8)}/${bm[0].slice(5,7)}</b>`,
      d:`<span class="big">${fUSD(bm[1].m)}</span> de margen · ${mp.toFixed(0)}% sobre venta · ${(bm[1].m/margen*100).toFixed(0)}% del margen del periodo.`});
  }
  // 6c) Top SKU por margen ABSOLUTO
  const skuM={};
  rows.forEach(r=>{const g=skuM[r.sku]||(skuM[r.sku]={d:r.d,lf:r.lf,m:0,tv:0,q:0});g.m+=r.m;g.tv+=r.tv;g.q+=r.q;});
  const topSkuM=Object.entries(skuM).map(([k,v])=>({k,...v})).sort((a,b)=>b.m-a.m);
  if(topSkuM.length){
    const tm=topSkuM[0]; const mp=tm.tv?tm.m/tm.tv*100:0;
    out.push({t:'star',ic:'star',type:'skuTop',
      h:`SKU más rentable: <b>${tm.k}</b>`,
      d:`${short(tm.d,30)} · <span class="big">${fUSD2(tm.m)}</span> de margen (${mp.toFixed(0)}%) en ${fNum(tm.q)} u.`});
  }
  // 6d) Top clientes locales finales
  const finals=rows.filter(r=>r.g===1);
  if(finals.length){
    const arrF=Object.entries(groupAgg(finals,'cl')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const t=arrF[0]; const vF=sum(finals,'tv');
    out.push({t:'info',ic:'users',type:'cliGrp',param:'1',
      h:`Top cliente local final: <b>${t.k.length>22?t.k.slice(0,21)+'…':t.k}</b>`,
      d:`<span class="big">${fUSD(t.venta)}</span> · ${(t.venta/vF*100).toFixed(0)}% del segmento · ${arrF.length} clientes finales.`});
  }
  // 6e) Top clientes revendedores
  const reseller=rows.filter(r=>r.g===2);
  if(reseller.length){
    const arrR=Object.entries(groupAgg(reseller,'cl')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const t=arrR[0]; const vR=sum(reseller,'tv');
    out.push({t:'info',ic:'users',type:'cliGrp',param:'2',
      h:`Top revendedor: <b>${t.k.length>22?t.k.slice(0,21)+'…':t.k}</b>`,
      d:`<span class="big">${fUSD(t.venta)}</span> · ${(t.venta/vR*100).toFixed(0)}% del segmento · ${arrR.length} revendedores.`});
  }
  // 7) Notas de crédito
  const nc=rows.filter(r=>r.doc==='NC');
  if(nc.length){
    out.push({t:'warn',ic:'alert',type:'nc',
      h:`<b>${nc.length}</b> nota${nc.length>1?'s':''} de crédito en el periodo`,
      d:`Impacto de <span class="big">${fUSD2(sum(nc,'tv'))}</span> (devoluciones/ajustes), ya descontado de los totales.`});
  }

  grid.innerHTML = out.map(o=>`
    <div class="ins ${o.t} clickable" data-type="${o.type||''}" data-param="${(o.param||'').replace(/"/g,'&quot;')}">
      <div class="ic"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${ICO[o.ic]}</svg></div>
      <div class="itxt">${o.h}<br><span style="color:var(--ink3);font-size:12px">${o.d}</span><span class="ins-more">Ver detalle →</span></div>
    </div>`).join('');
  grid.querySelectorAll('.ins.clickable').forEach(c=>c.onclick=()=>openInsight(c.dataset.type, c.dataset.param));
}

/* ===== DETALLE EN VENTANA FLOTANTE ===== */
function miniTable(headers, rows){
  return `<div class="tbl-wrap"><table><thead><tr>${headers.map((h,i)=>`<th class="${i>0?'num':''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i>0?'num':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function statRow(items){ // items: [{l,v,c}]
  return `<div class="mstats">${items.map(s=>`<div class="mstat"><div class="ml">${s.l}</div><div class="mv" style="color:${s.c||'var(--ink)'}">${s.v}</div></div>`).join('')}</div>`;
}
function pctOf(part,total){ return total? (part/total*100):0; }

const DETAIL = {
  ven(rows){
    const venta=sum(rows,'tv');
    const arr=Object.entries(groupAgg(rows,'v')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const body=arr.map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span>${x.k.split(' ').slice(0,2).join(' ')}</div>`,
      fUSD2(x.venta), pctOf(x.venta,venta).toFixed(1)+'%', fNum(x.trans),
      fUSD2(x.margen), `<span class="${x.margen>=0?'pos':'neg'}">${fPct(pctOf(x.margen,x.venta))}</span>`
    ]);
    return {title:'Detalle por vendedor',
      html: statRow([{l:'Vendedores',v:arr.length},{l:'Venta total',v:fUSD(venta),c:'var(--amber-d)'},{l:'Concentración top‑1',v:pctOf(arr[0].venta,venta).toFixed(0)+'%',c:'var(--rose)'}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + miniTable(['Vendedor','Venta','% del total','Transac.','Margen','Margen %'], body),
      chart(){ const top=arr.slice(0,11);
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map(x=>x.k.split(' ')[0]),
          datasets:[{label:'Venta',data:top.map(x=>x.venta),backgroundColor:C.amber,borderRadius:5},
                    {label:'Margen',data:top.map(x=>x.margen),backgroundColor:C.green,borderRadius:5}]},
          options:{maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:9,padding:10}}},
            scales:{x:{grid:{display:false}},y:{grid:{color:C.line},ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}}}}}); }};
  },
  pareto(rows){
    const venta=sum(rows,'tv');
    const arr=Object.entries(groupAgg(rows,'cl')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    let acc=0; const withCum=arr.map(x=>{acc+=x.venta; return {...x,cum:acc,cumPct:pctOf(acc,venta)};});
    const n80=withCum.findIndex(x=>x.cumPct>=80)+1;
    const body=withCum.slice(0,40).map((x,i)=>[
      `<div class="rank"><span class="rk ${x.cumPct<=80?'top':''}">${i+1}</span>${x.k.length>34?x.k.slice(0,33)+'…':x.k}</div>`,
      fUSD2(x.venta), pctOf(x.venta,venta).toFixed(1)+'%', `<b>${x.cumPct.toFixed(1)}%</b>`,
      `<span class="${x.margen>=0?'pos':'neg'}">${fPct(pctOf(x.margen,x.venta))}</span>`
    ]);
    return {title:'Pareto de clientes (80/20)',
      html: statRow([{l:'Clientes activos',v:fNum(arr.length)},{l:'Generan el 80%',v:n80+' clientes',c:'var(--blue)'},{l:'= del total',v:pctOf(n80,arr.length).toFixed(0)+'%',c:'var(--violet)'}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + `<p class="mnote">Tabla: top 40 clientes. La columna <b>% acumulado</b> muestra cuánto suman entre todos hasta ese punto; los resaltados forman el 80% de la venta.</p>`
        + miniTable(['Cliente','Venta','% indiv.','% acum.','Margen %'], body),
      chart(){ const top=withCum.slice(0,15);
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map((x,i)=>'#'+(i+1)),
          datasets:[{type:'line',label:'% acumulado',data:top.map(x=>x.cumPct),borderColor:C.violet,borderWidth:2.5,tension:.3,yAxisID:'y1',pointRadius:2.5},
                    {label:'Venta',data:top.map(x=>x.venta),backgroundColor:C.blue,borderRadius:5,yAxisID:'y'}]},
          options:{maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:9,padding:10}},
            tooltip:{callbacks:{title:items=>top[items[0].dataIndex].k}}},
            scales:{x:{grid:{display:false}},y:{grid:{color:C.line},ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}},
              y1:{position:'right',grid:{display:false},min:0,max:100,ticks:{callback:v=>v+'%',color:C.violet}}}}}); }};
  },
  cli(rows,name){
    const sub=rows.filter(r=>r.cl===name);
    const venta=sum(sub,'tv'),margen=sum(sub,'m');
    const byLf=Object.entries(groupAgg(sub,'lf')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const docs=new Set(sub.map(r=>r.nd)).size;
    const tx=sub.slice().sort((a,b)=>b.tv-a.tv).slice(0,25).map(r=>[
      `${r.f.slice(8)}/${r.f.slice(5,7)}`, r.lf, `${r.sku} ${short(r.d,16)}`, fNum(r.q),
      fUSD2(r.tv), `<span class="${r.m>=0?'pos':'neg'}">${fUSD2(r.m)}</span>`]);
    return {title:'Cliente · '+name,
      html: statRow([{l:'Venta',v:fUSD(venta),c:'var(--amber-d)'},{l:'Margen',v:fUSD(margen),c:'var(--emerald-d)'},{l:'Margen %',v:fPct(pctOf(margen,venta))},{l:'Documentos',v:docs},{l:'Líneas vendidas',v:fNum(sub.length)}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + '<p class="mnote">Top transacciones de este cliente (máx. 25, por venta).</p>'
        + miniTable(['Fecha','Línea','SKU','Cant','Venta','Margen'], tx),
      chart(){ const top=byLf.slice(0,10).reverse();
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map(x=>x.k),datasets:[{data:top.map(x=>x.venta),backgroundColor:C.amber,borderRadius:5}]},
          options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Venta por familia',color:C.mut,font:{size:12,weight:'600'}}},
            scales:{x:{grid:{color:C.line},ticks:{callback:fAx}},y:{grid:{display:false}}}}}); }};
  },
  fam(rows,name){
    const sub=rows.filter(r=>r.lf===name);
    const venta=sum(sub,'tv'),margen=sum(sub,'m');
    const bySku={}; sub.forEach(r=>{const g=bySku[r.sku]||(bySku[r.sku]={d:r.d,venta:0,cant:0,m:0});g.venta+=r.tv;g.cant+=r.q;g.m+=r.m;});
    const skus=Object.entries(bySku).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const topCli=Object.entries(groupAgg(sub,'cl')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta).slice(0,8);
    const body=skus.slice(0,25).map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span><span><b style="font-family:'Spline Sans Mono';font-size:11px;color:var(--ink2)">${x.k}</b> ${short(x.d,18)}</span></div>`,
      fUSD2(x.venta), fNum(x.cant), `<span class="${x.m>=0?'pos':'neg'}">${fPct(pctOf(x.m,x.venta))}</span>`]);
    return {title:'Familia · '+name,
      html: statRow([{l:'Venta',v:fUSD(venta),c:'var(--amber-d)'},{l:'Margen',v:fUSD(margen),c:'var(--emerald-d)'},{l:'Margen %',v:fPct(pctOf(margen,venta))},{l:'SKUs distintos',v:skus.length},{l:'Unidades',v:fNum(sum(sub,'q'))}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + '<p class="mnote">SKUs de esta familia (máx. 25, por venta).</p>'
        + miniTable(['SKU · Descripción','Venta','Unid.','Margen %'], body),
      chart(){ const top=topCli.slice().reverse();
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map(x=>short(x.k,22)),datasets:[{data:top.map(x=>x.venta),backgroundColor:C.blue,borderRadius:5}]},
          options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Top clientes de esta familia',color:C.mut,font:{size:12,weight:'600'}}},
            scales:{x:{grid:{color:C.line},ticks:{callback:fAx}},y:{grid:{display:false}}}}}); }};
  },
  day(rows,date){
    const sub=rows.filter(r=>r.f===date);
    const venta=sum(sub,'tv'),margen=sum(sub,'m');
    const byVen=Object.entries(groupAgg(sub,'v')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta);
    const byLf=Object.entries(groupAgg(sub,'lf')).map(([k,v])=>({k,...v})).sort((a,b)=>b.venta-a.venta).slice(0,12);
    const dt=new Date(date+'T00:00:00');
    const body=byVen.map((x,i)=>[`<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span>${x.k.split(' ').slice(0,2).join(' ')}</div>`,
      fUSD2(x.venta), fNum(x.trans), `<span class="${x.margen>=0?'pos':'neg'}">${fPct(pctOf(x.margen,x.venta))}</span>`]);
    return {title:'Día · '+DOW[dt.getDay()]+' '+date,
      html: statRow([{l:'Venta del día',v:fUSD(venta),c:'var(--amber-d)'},{l:'Margen',v:fUSD(margen),c:'var(--emerald-d)'},{l:'Margen %',v:fPct(pctOf(margen,venta))},{l:'Documentos',v:new Set(sub.map(r=>r.nd)).size},{l:'Líneas',v:fNum(sub.length)}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + miniTable(['Vendedor','Venta','Transac.','Margen %'], body),
      chart(){ const top=byLf.slice().reverse();
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map(x=>x.k),datasets:[{data:top.map(x=>x.venta),backgroundColor:C.amber,borderRadius:5}]},
          options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Venta por familia (ese día)',color:C.mut,font:{size:12,weight:'600'}}},
            scales:{x:{grid:{color:C.line},ticks:{callback:fAx}},y:{grid:{display:false}}}}}); }};
  },
  loss(rows){
    const arr=Object.entries(groupAgg(rows,'cl')).map(([k,v])=>({k,...v})).filter(x=>x.margen<0).sort((a,b)=>a.margen-b.margen);
    const body=arr.map((x,i)=>[`<div class="rank"><span class="rk">${i+1}</span>${x.k.length>34?x.k.slice(0,33)+'…':x.k}</div>`,
      fUSD2(x.venta), `<span class="neg">${fUSD2(x.margen)}</span>`, fNum(x.trans)]);
    // detalle de transacciones a pérdida
    const lossTx=rows.filter(r=>r.m<0).sort((a,b)=>a.m-b.m).slice(0,25).map(r=>[
      `${r.f.slice(8)}/${r.f.slice(5,7)}`, short(r.cl,22), `${r.sku}`, r.doc==='NC'?'<span class="pill nc">NC</span>':'venta',
      fUSD2(r.tv), `<span class="neg">${fUSD2(r.m)}</span>`]);
    return {title:'Clientes con margen negativo',
      html: statRow([{l:'Clientes a pérdida',v:arr.length,c:'var(--rose)'},{l:'Pérdida conjunta',v:fUSD2(arr.reduce((a,c)=>a+c.margen,0)),c:'var(--rose)'}])
        + '<p class="mnote">Clientes cuyo margen total es negativo (resta a las utilidades).</p>'
        + miniTable(['Cliente','Venta','Margen','Transac.'], body)
        + '<p class="mnote" style="margin-top:16px">Líneas individuales que generaron pérdida (máx. 25):</p>'
        + miniTable(['Fecha','Cliente','SKU','Tipo','Venta','Margen'], lossTx),
      chart:null};
  },
  nc(rows){
    const arr=rows.filter(r=>r.doc==='NC').sort((a,b)=>a.f.localeCompare(b.f));
    const body=arr.map(r=>[`${r.f.slice(8)}/${r.f.slice(5,7)}`, r.nd, short(r.cl,24), `${r.sku} ${short(r.d,14)}`,
      `<span class="neg">${fUSD2(r.tv)}</span>`, `<span class="neg">${fUSD2(r.m)}</span>`]);
    return {title:'Notas de crédito',
      html: statRow([{l:'Notas de crédito',v:arr.length,c:'var(--rose)'},{l:'Monto total',v:fUSD2(sum(arr,'tv')),c:'var(--rose)'},{l:'Margen',v:fUSD2(sum(arr,'m'))}])
        + '<p class="mnote">Devoluciones/ajustes del periodo (ya descontados de los totales del panel).</p>'
        + miniTable(['Fecha','Documento','Cliente','SKU','Venta','Margen'], body),
      chart:null};
  },
  skuTop(rows){
    const m={};
    rows.forEach(r=>{const g=m[r.sku]||(m[r.sku]={d:r.d,lf:r.lf,m:0,tv:0,tc:0,q:0,n:0});g.m+=r.m;g.tv+=r.tv;g.tc+=r.tc;g.q+=r.q;g.n++;});
    const arr=Object.entries(m).map(([k,v])=>({k,...v,mp:v.tv?v.m/v.tv*100:0}));
    const topM=arr.slice().sort((a,b)=>b.m-a.m).slice(0,25);
    const topV=arr.slice().sort((a,b)=>b.tv-a.tv).slice(0,25);
    // SKUs frecuentes con mejor margen % (filtramos los muy pequeños)
    const totalV=sum(rows,'tv'), totalM=sum(rows,'m');
    const topMp=arr.filter(x=>x.tv>=totalV*0.003).sort((a,b)=>b.mp-a.mp).slice(0,15);
    const bodyM=topM.map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span><span><b style="font-family:'Spline Sans Mono';font-size:11px;color:var(--ink2)">${x.k}</b> ${short(x.d,18)}</span></div>`,
      `<span class="pill g${x.lf==='SIN LÍNEA'?'1':'1'}" style="background:var(--surface2);color:var(--ink3)">${x.lf}</span>`,
      fUSD2(x.tv), fNum(x.q), `<b class="pos">${fUSD2(x.m)}</b>`, `<span class="pos">${x.mp.toFixed(0)}%</span>`]);
    const bodyMp=topMp.map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span><span><b style="font-family:'Spline Sans Mono';font-size:11px;color:var(--ink2)">${x.k}</b> ${short(x.d,18)}</span></div>`,
      fUSD2(x.tv), `<b class="pos">${fUSD2(x.m)}</b>`, `<span class="pos">${x.mp.toFixed(0)}%</span>`]);
    return {title:'Top SKUs por margen',
      html: statRow([{l:'SKUs distintos',v:fNum(arr.length)},{l:'Top 25 aportan',v:fUSD2(topM.reduce((a,x)=>a+x.m,0)),c:'var(--emerald-d)'},{l:'% del margen total',v:(topM.reduce((a,x)=>a+x.m,0)/totalM*100).toFixed(0)+'%'}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + '<p class="mnote">Top 25 SKUs ordenados por <b>margen absoluto en US$</b>. Estos son los productos que más rentabilidad aportan al periodo.</p>'
        + miniTable(['SKU · Descripción','Familia','Venta','Unid.','Margen','Margen %'], bodyM)
        + '<p class="mnote" style="margin-top:18px">SKUs con <b>mejor margen %</b> (de productos con venta significativa, ≥0.3% del total):</p>'
        + miniTable(['SKU · Descripción','Venta','Margen','Margen %'], bodyMp),
      chart(){ const top=topM.slice(0,12).reverse();
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels:top.map(x=>x.k+' · '+short(x.d,16)),
          datasets:[{label:'Margen',data:top.map(x=>x.m),backgroundColor:C.green,borderRadius:5}]},
          options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Top 12 SKUs por margen US$',color:C.mut,font:{size:12,weight:'600'}}},
            scales:{x:{grid:{color:C.line},ticks:{callback:fAx}},y:{grid:{display:false},ticks:{font:{size:10}}}}}}); }};
  },
  cliGrp(rows, gid){
    const g = parseInt(gid,10);
    const sub = rows.filter(r=>r.g===g);
    const label = GRP[g];
    if(!sub.length) return {title:label, html:'<div class="empty">Sin clientes de este segmento en el filtro actual</div>', chart:null};
    const arr=Object.entries(groupAgg(sub,'cl')).map(([k,v])=>({k,...v,mp:v.venta?v.margen/v.venta*100:0}));
    const venta=sum(sub,'tv'), margen=sum(sub,'m');
    const topV=arr.slice().sort((a,b)=>b.venta-a.venta).slice(0,10);
    const topM=arr.slice().sort((a,b)=>b.margen-a.margen).slice(0,10);
    const bodyV=topV.map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span>${x.k.length>32?x.k.slice(0,31)+'…':x.k}</div>`,
      fUSD2(x.venta), (x.venta/venta*100).toFixed(1)+'%', fNum(x.trans),
      `<span class="${x.margen>=0?'pos':'neg'}">${fUSD2(x.margen)}</span>`, `<span class="${x.margen>=0?'pos':'neg'}">${x.mp.toFixed(0)}%</span>`]);
    const bodyM=topM.map((x,i)=>[
      `<div class="rank"><span class="rk ${i<3?'top':''}">${i+1}</span>${x.k.length>32?x.k.slice(0,31)+'…':x.k}</div>`,
      fUSD2(x.venta), `<b class="${x.margen>=0?'pos':'neg'}">${fUSD2(x.margen)}</b>`, `<span class="${x.margen>=0?'pos':'neg'}">${x.mp.toFixed(0)}%</span>`,
      (x.margen/margen*100).toFixed(1)+'%']);
    return {title:'Top 10 · '+label,
      html: statRow([{l:'Clientes del segmento',v:fNum(arr.length)},{l:'Venta del segmento',v:fUSD(venta),c:'var(--amber-d)'},{l:'Margen del segmento',v:fUSD(margen),c:'var(--emerald-d)'},{l:'Margen %',v:fPct(venta?margen/venta*100:0)}])
        + '<div class="mchart"><canvas id="mCanvas"></canvas></div>'
        + '<p class="mnote"><b>Top 10 por venta</b> en el segmento:</p>'
        + miniTable(['Cliente','Venta','% segm.','Docs.','Margen','Margen %'], bodyV)
        + '<p class="mnote" style="margin-top:18px"><b>Top 10 por margen</b> en el segmento:</p>'
        + miniTable(['Cliente','Venta','Margen','Margen %','% del margen segm.'], bodyM),
      chart(){
        const labels=topV.map(x=>short(x.k,22)).reverse();
        const venta_s=topV.map(x=>x.venta).reverse();
        // mapear margen al mismo orden de topV
        const margen_s=topV.map(x=>x.margen).reverse();
        modalChart=new Chart($('#mCanvas'),{type:'bar',data:{labels,datasets:[
          {label:'Venta',data:venta_s,backgroundColor: g===1?C.blue:C.violet, borderRadius:5},
          {label:'Margen',data:margen_s,backgroundColor:C.green,borderRadius:5}]},
          options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{usePointStyle:true,boxWidth:9,padding:10}},title:{display:true,text:'Top 10 clientes · venta y margen',color:C.mut,font:{size:12,weight:'600'}}},
            scales:{x:{grid:{color:C.line},ticks:{callback:fAx}},y:{grid:{display:false},ticks:{font:{size:10}}}}}}); }};
  }
};

function openInsight(type, param){
  if(!type || !DETAIL[type]) return;
  if(modalChart){ modalChart.destroy(); modalChart=null; }
  const det = DETAIL[type](INS_ROWS, param);
  $('#mTitle').textContent = det.title;
  $('#mBody').innerHTML = det.html;
  $('#modal').classList.add('open');
  document.body.style.overflow='hidden';
  if(det.chart) requestAnimationFrame(()=>det.chart());
}
function closeModal(){
  $('#modal').classList.remove('open');
  document.body.style.overflow='';
  if(modalChart){ modalChart.destroy(); modalChart=null; }
}


/* ===== COMPARADOR DE PERIODOS ===== */
function periodStats(rows,d1,d2){
  const sub=rows.filter(r=>(!d1||r.f>=d1)&&(!d2||r.f<=d2));
  const venta=sum(sub,'tv'),margen=sum(sub,'m');
  return {rows:sub,venta,margen,mPct:venta?margen/venta*100:0,
    docs:new Set(sub.map(r=>r.nd)).size, trans:sub.length,
    ticket: new Set(sub.map(r=>r.nd)).size ? venta/new Set(sub.map(r=>r.nd)).size : 0};
}
function deltaHTML(a,b,money){
  if(!a && !b) return '<span class="delta flat">—</span>';
  const d = a? (b-a)/Math.abs(a)*100 : (b?100:0);
  const cls = d>0.5?'up':d<-0.5?'down':'flat';
  const arr = d>0.5?'▲':d<-0.5?'▼':'■';
  return `<span class="delta ${cls}">${arr} ${d>0?'+':''}${d.toFixed(1)}%</span>`;
}
function renderCompare(){
  const base=filterNonDate();
  const A=periodStats(base,ST.aD1,ST.aD2), B=periodStats(base,ST.bD1,ST.bD2);
  const ks=[
    {l:'Venta',a:fUSD(A.venta),b:fUSD(B.venta),da:A.venta,db:B.venta},
    {l:'Margen',a:fUSD(A.margen),b:fUSD(B.margen),da:A.margen,db:B.margen},
    {l:'Margen %',a:fPct(A.mPct),b:fPct(B.mPct),da:A.mPct,db:B.mPct},
    {l:'Documentos',a:fNum(A.docs),b:fNum(B.docs),da:A.docs,db:B.docs},
    {l:'Ticket prom.',a:fUSD2(A.ticket),b:fUSD2(B.ticket),da:A.ticket,db:B.ticket},
  ];
  $('#cmpKpis').innerHTML = ks.map(k=>`
    <div class="cmpk">
      <div class="l">${k.l}</div>
      <div class="vals"><span class="va">${k.a}</span><span class="sep">vs</span><span class="vb">${k.b}</span></div>
      ${deltaHTML(k.da,k.db)}
    </div>`).join('');

  // chart: A vs B por top 7 lineas (venta)
  const top=Object.entries(groupAgg(base,'lf')).map(([k,v])=>({k,venta:v.venta})).sort((a,b)=>b.venta-a.venta).slice(0,7).map(x=>x.k);
  const sumBy=(rows,lf)=>rows.filter(r=>r.lf===lf).reduce((a,r)=>a+r.tv,0);
  mk('#cCmp',{type:'bar',data:{labels:top,datasets:[
    {label:'Periodo A',data:top.map(l=>sumBy(A.rows,l)),backgroundColor:C.amber,borderRadius:5,maxBarThickness:26},
    {label:'Periodo B',data:top.map(l=>sumBy(B.rows,l)),backgroundColor:C.blue,borderRadius:5,maxBarThickness:26}]},
    options:{maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,boxHeight:10,usePointStyle:true,padding:12}},
      title:{display:true,text:'Venta por familia: A vs B',color:C.mut,font:{size:12,weight:'600'},padding:{bottom:8}},
      tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${fUSD2(c.parsed.y)}`}}},
      scales:{x:{...noGrid,ticks:{font:{size:10}}},y:{...gridOpt,beginAtZero:true,ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k'}}}}});
}


function render(){
  const rows = applyFilters();
  renderChips();
  renderKPIs(rows);
  renderInsights(rows);
  renderTrend(rows);
  renderCumul(rows);
  renderHeat(rows);
  renderGroup(rows);
  renderVen(rows);
  renderLf(rows);
  renderScatter(rows);
  renderDow(rows);
  renderRank(rows);
  renderDetail(rows);
  renderCompare();
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
$('#granSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  $('#granSeg').querySelectorAll('button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); ST.gran=b.dataset.g; renderTrend(applyFilters());
});
$('#pgPrev').onclick=()=>{if(ST.page>1){ST.page--;renderDetail(applyFilters());}};
$('#pgNext').onclick=()=>{ST.page++;renderDetail(applyFilters());};

// Exportar CSV
$('#exportBtn').onclick=exportCSV;

// Cierre del modal de detalle
$('#mClose').onclick=closeModal;
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

// Info toggles ("¿cómo leer?")
document.querySelectorAll('.info-btn').forEach(b=>b.onclick=()=>{
  const box=b.closest('.card').querySelector('.info-box');
  if(box) box.classList.toggle('show');
});

// Comparador: fija rangos por defecto (primera vs segunda mitad). Reutilizable al recargar datos.
function buildCompare(){
  const fechas=[...new Set(DATA.map(r=>r.f))].sort();
  if(!fechas.length) return;
  const min=fechas[0], max=fechas[fechas.length-1];
  const mid=fechas[Math.floor(fechas.length/2)];
  const midNext=fechas[Math.floor(fechas.length/2)+1]||mid;
  ST.aD1=min; ST.aD2=mid; ST.bD1=midNext; ST.bD2=max;
  const set=(id,v)=>{const e=$(id); e.min=min; e.max=max; e.value=v;};
  set('#aD1',min); set('#aD2',mid); set('#bD1',midNext); set('#bD2',max);
}
// listeners del comparador (una sola vez)
[['#aD1','aD1'],['#aD2','aD2'],['#bD1','bD1'],['#bD2','bD2']].forEach(([id,key])=>{
  $(id).addEventListener('change',e=>{ST[key]=e.target.value; renderCompare();});
});

/* ===== FUENTE DE DATOS EN VIVO (Google Sheets) ===== */
const SHEET_ID = '1scUhyHY0BxcC4kQyhZScSMq0vPcWFy1iSTW_vJ-BkWI';
const SHEET_TAB = 'Data';
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;

function parseGvizDate(v){
  if(v==null) return null;
  if(typeof v==='string'){
    let m=v.match(/^Date\((\d+),(\d+),(\d+)/);                 // Date(2026,4,21)
    if(m) return `${m[1]}-${String(+m[2]+1).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
    m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);              // 21/5/2026
    if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);                     // 2026-05-21
    if(m) return v.slice(0,10);
  }
  return null;
}
const numv = v => { if(v==null||v==='') return 0; if(typeof v==='number') return v;
  const n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?0:n; };

function transformSheet(json){
  const cols = json.table.cols.map(c=>(c.label||'').trim());
  const idx = name => cols.findIndex(c=>c.toLowerCase().startsWith(name.toLowerCase()));
  const iV=idx('Nombre Vendedor'), iK=idx('Key Vendedor'), iDoc=idx('Documento'), iND=idx('N° Documento')>=0?idx('N° Documento'):idx('N'),
        iCl=idx('Nombre de cliente'), iG=idx('Grupo'), iF=idx('Fecha'), iSku=idx('SKU'), iD=idx('Descripción'),
        iLf=idx('Linea'), iQ=idx('Cantidad'), iTv=idx('Total Venta'), iTc=idx('Total Costo'), iM=idx('Margen Total');
  if(iV<0||iTv<0||iF<0) throw new Error('Encabezados no reconocidos');
  const recs=[];
  json.table.rows.forEach(row=>{
    const c=row.c||[]; const g=(i)=> i>=0&&c[i]?c[i].v:null;
    const f=parseGvizDate(g(iF)); const ven=g(iV);
    if(!f||!ven) return;
    const docRaw=(g(iDoc)||'')+'';
    const grpRaw=(g(iG)||'')+'';
    recs.push({
      v:ven, k:(g(iK)||'')+'', doc:docRaw.toLowerCase().includes('cr')||docRaw.toLowerCase().includes('nota')?'NC':'FB',
      nd:(g(iND)||'')+'', cl:(g(iCl)||'')+'', g:grpRaw.trim().startsWith('1')?1:2, f:f,
      sku:(g(iSku)||'')+'', d:(g(iD)||'')+'', lf:(g(iLf)||'SIN LÍNEA')+'',
      q:Math.round(numv(g(iQ))), tv:+numv(g(iTv)).toFixed(2), tc:+numv(g(iTc)).toFixed(2), m:+numv(g(iM)).toFixed(2)
    });
  });
  return recs;
}

function setStatus(state, msg){
  const el=$('#liveStatus'); if(!el) return;
  el.className='live '+state;        // ok | local | loading | err
  el.querySelector('.lt').textContent=msg;
  const rb=$('#refreshBtn'); if(rb) rb.classList.toggle('spin', state==='loading');
}

async function loadLive(manual){
  setStatus('loading','Actualizando…');
  try{
    const res = await fetch(GVIZ_URL, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const txt = await res.text();
    const m = txt.match(/setResponse\(([\s\S]*)\)\s*;?\s*$/);
    if(!m) throw new Error('Respuesta inesperada');
    const json = JSON.parse(m[1]);
    const recs = transformSheet(json);
    if(!recs.length) throw new Error('Sin filas válidas');
    DATA = recs;
    buildSelectors(); buildCompare();
    Object.assign(ST,{cli:'',ven:'',lf:'',grp:'',doc:'',d1:'',d2:'',page:1});
    ['#fCli','#fVen','#fLf','#fGrp','#fDoc','#fD1','#fD2'].forEach(id=>{if($(id))$(id).value='';});
    render();
    const now=new Date().toLocaleString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    setStatus('ok',`En vivo · ${fNum(recs.length)} reg · ${now}`);
  }catch(e){
    console.warn('Carga en vivo falló:', e.message);
    setStatus('local','Datos locales (Sheet no accesible)');
    if(manual) alert('No se pudo leer el Google Sheet en vivo.\n\nVerifica que esté compartido como "Cualquiera con el enlace: Lector".\n\nDetalle: '+e.message);
  }
}

/* ===== GO ===== */
buildSelectors();
buildCompare();
render();          // pinta al instante con datos locales (data.js)
loadLive(false);   // intenta refrescar desde Google Sheets
$('#refreshBtn') && ($('#refreshBtn').onclick=()=>loadLive(true));
