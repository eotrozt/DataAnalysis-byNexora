(function(){
'use strict';
const E=Engine, I=Insights, nf=I.nf, num=I.num, pct=I.pct;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const COL={cyan:'#55C7E8',green:'#35C995',amber:'#FFBE45',violet:'#7278F5'};
const S={headers:null,rows:null,ragged:0,fileName:'',isSample:false,D:null,A:null,items:[],tab:'insights',wb:null,notes:[],rules:[],rowColors:new Map(),dataLimit:50,metricName:null,dateName:null,popRow:null,prep:null,original:null,originalFile:null,config:{rules:[],dedupe:false,excludeOut:false,ctx:'geral'},history:[],audit:[],pending:null};

/* ---------- leitura de arquivos ---------- */
let worker=null, cancelWork=null;
async function work(data){
  if(worker)throw new Error('Aguarde a operação atual.');
  $('busy').hidden=false;$('appShell').inert=true;
  try{return await new Promise((resolve,reject)=>{
    worker=new Worker('analysis-worker.js');
    cancelWork=()=>reject(new Error('Operação cancelada. Sua base anterior foi preservada.'));
    worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);
    worker.onerror=()=>reject(new Error('Não foi possível iniciar o processamento local. No navegador, abra o aplicativo por um servidor local; no desktop, execute npm start.'));
    worker.postMessage(data);
  })}finally{if(worker)worker.terminate();worker=null;cancelWork=null;$('busy').hidden=true;$('appShell').inert=false}
}
function previewTable(headers,rows,rowNos){
 return `<div class="scroll preview-table"><table><thead><tr><th>Linha</th>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,10).map((r,i)=>`<tr><td>${rowNos?rowNos[i]:i+2}</td>${headers.map((_,j)=>`<td>${esc(r[j]??'∅')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="sub">Prévia de até 10 registros. O arquivo original não é alterado.</p>`;
}
function openPreview(title,html,pending){
 S.pending=pending;$('previewTitle').textContent=title;$('previewBody').innerHTML=html;$('confirmPreview').textContent=pending.kind==='import'?'Analisar esta base':'Aplicar correção';$('previewDialog').showModal();
}
function loadMatrix(matrix,name,sample,notes=[],file=null,sheets=null,sheetIndex=0){
 try{
  const source=Processor.validate(matrix);
  openPreview('Prévia da importação',`<p><b>${esc(name)}</b> · ${nf(source.rows.length)} registros · ${source.headers.length} colunas</p><p class="muted">Nenhuma linha será excluída automaticamente. Cabeçalhos repetidos recebem sufixos únicos na análise.</p>${previewTable(source.headers,source.rows)}`,{kind:'import',source,name,sample,notes,file,sheets,sheetIndex});
 }catch(e){showMsg(e.message)}
}
async function readFile(file){
 try{
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['csv','tsv','txt','xlsx','xls'].includes(ext))throw new Error('Formato não suportado. Use CSV, TSV, TXT, XLSX ou XLS.');
  if(!file.size)throw new Error('O arquivo está vazio.');
  if(file.size>Processor.LIMITS.bytes)throw new Error('O arquivo ultrapassa o limite de 50 MB.');
  const bytes=await file.arrayBuffer();
  if(['xlsx','xls'].includes(ext)){
    const sheets=await work({task:'workbook',bytes});
    if(!sheets.length)throw new Error('O arquivo não contém planilhas.');
    loadMatrix(sheets[0].matrix,file.name+' · '+sheets[0].name,false,['Fórmulas Excel usam o valor armazenado no arquivo; não são recalculadas.'],file,sheets,0);
  }else{
    let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('windows-1252').decode(bytes)}
    const parsed=await work({task:'text',text});loadMatrix(parsed.rows,file.name,false,['Delimitador: '+parsed.delim],file);
  }
 }catch(e){showMsg('Importação: '+e.message)}
}
function loadSheet(name){
 const index=S.wb.findIndex(s=>s.name===name);if(index<0)return;
 loadMatrix(S.wb[index].matrix,S.wbName+' · '+name,false,S.notes,S.originalFile,S.wb,index);
 // Keep the selection tied to the active analysis until the preview is confirmed.
 $('sheetSel').value=S.activeSheet;
}
async function loadSample(){try{const p=await work({task:'text',text:I.makeSample()});loadMatrix(p.rows,'exemplo_vendas.csv',true)}catch(e){showMsg(e.message)}}
function showMsg(t){const m=$('msg');m.hidden=!t;m.className=t?'banner err':'';m.innerHTML=t?`<b>Atenção</b><span>${esc(t)}</span>`:''}

/* ---------- controles ---------- */
function fillSelects(){
  const D=S.D;
  $('ctx').innerHTML=Object.entries(I.CTX).map(([k,v])=>`<option value="${k}" ${k===S.ctx?'selected':''}>${esc(v.nome)}</option>`).join('');
  const nums=D.cols.filter(c=>c.type==='numérica');
  $('metricSel').innerHTML=nums.length?nums.map(c=>`<option value="${esc(c.name)}" ${c.name===S.metricName?'selected':''}>${esc(c.name)}</option>`).join(''):'<option value="">(nenhuma coluna numérica)</option>';
  const dts=D.cols.filter(c=>c.type==='data');
  $('dateSel').innerHTML='<option value="">(sem análise temporal)</option>'+dts.map(c=>`<option value="${esc(c.name)}" ${c.name===S.dateName?'selected':''}>${esc(c.name)}</option>`).join('');
}
S.ctx='geral';
function colIdx(D,name){return name?D.cols.findIndex(c=>c.name===name):-1}
function setFMsg(t,bad){const m=$('fMsg');m.textContent=t||'';m.className='sub'+(bad?' bad':'')}

/* ---------- execução ---------- */
function freezeSource(source){
 const copy=structuredClone(source);copy.rows.forEach(Object.freeze);Object.freeze(copy.rows);Object.freeze(copy.headers);return Object.freeze(copy);
}
function commitResult(result){
 $('printReport').innerHTML='';$('printReport').hidden=true;
 S.D=result.D;S.A=result.A;S.prep=result.prep;S.items=result.items;S.config=structuredClone(result.config);S.rules=S.config.rules;S.ctx=S.config.ctx;S.metricName=S.config.metricName;S.dateName=S.config.dateName;
 $('exDup').checked=!!S.config.dedupe;$('exOut').checked=!!S.config.excludeOut;
 $('welcome').hidden=true;$('datasetStatus').textContent=S.fileName;
 for(const id of ['copyBtn','pdfBtn','excelBtn','originalBtn','previewOptions','restoreBtn'])$(id).disabled=false;
 $('undoBtn').disabled=!S.history.length;
 $('colList').innerHTML=E.uniqueNames(S.headers).map(n=>`<option value="${esc(n)}">`).join('');
 fillSelects();renderBanner();renderFilters();renderChips();renderView();renderHistory();showMsg('');
}
async function run(config=S.config){
 if(!S.original)return false;
 try{const result=await work({task:'analyze',source:S.original,config});commitResult(result);return true}catch(e){showMsg(e.message);fillSelects();return false}
}
function correctionLabel(config){return [config.dedupe?'Remover duplicatas':'Manter duplicatas',config.excludeOut?'Excluir atípicos de grupos e tendência':'Manter atípicos',...(config.rules||[]).map(r=>r.action+': '+r.col)].join(' · ')}
async function reviewCorrection(config,label){
 if(!S.original)return;
 try{
  const result=await work({task:'analyze',source:S.original,config,before:S.prep});
  const before=S.prep,after=result.prep;
  const {removed,returned,delta}=result.comparison;
  const affected=[...new Set([...removed,...returned,...after.pre.changes.map(c=>c.row)])];
  openPreview('Antes e depois da correção',`<p>${esc(label)}</p><div class="kv"><div><span>Registros antes → depois</span><b>${before.rows.length} → ${after.rows.length}</b></div><div><span>Colunas antes → depois</span><b>${before.headers.length} → ${after.headers.length}</b></div><div><span>Removidos / restaurados</span><b>${removed.length} / ${returned.length}</b></div><div><span>Células modificadas</span><b>${delta}</b></div><div><span>Base da métrica antes → depois</span><b>${S.A.nUsed} → ${result.A.nUsed}</b></div></div><p class="sub">Linhas removidas: ${removed.slice(0,30).join(', ')||'nenhuma'}${removed.length>30?'…':''}. Restauradas: ${returned.slice(0,30).join(', ')||'nenhuma'}.</p><p class="sub">Atípicos são excluídos apenas de grupos e tendência; permanecem na tabela e no perfil geral. Originais e versões usadas aparecem no Excel.</p><details><summary>Ver registros antes da correção</summary>${previewTable(before.headers,before.rows,before.rowNos)}</details><h3>Base resultante</h3>${previewTable(after.headers,after.rows,after.rowNos)}`,{kind:'correction',result,label,removed,returned,affected,delta});
 }catch(e){showMsg(e.message);$('exDup').checked=!!S.config.dedupe;$('exOut').checked=!!S.config.excludeOut}
}
function renderHistory(){
 $('historyPanel').hidden=!S.audit.length;
 $('historyPanel').innerHTML='<h2>Histórico e rastreabilidade</h2><p class="sub">Original preservado. O Excel inclui todas as linhas removidas e células alteradas na versão atual.</p><ol class="audit-list">'+S.audit.map(a=>`<li><b>${esc(a.label)}</b><span>${a.before} → ${a.after} registros · ${a.colsBefore} → ${a.colsAfter} colunas · ${a.delta||0} células alteradas</span><small>${esc(a.time)} · Linhas removidas: ${a.removed.slice(0,20).join(', ')||'nenhuma'}${a.removed.length>20?'…':''}</small></li>`).join('')+'</ol>';
}
function renderBanner(){
  const b=$('banner');
  if(S.isSample){b.hidden=false;b.innerHTML='<b>Exemplo</b><span>Dados fictícios gerados pelo app para demonstração, com problemas plantados de propósito (duplicatas, ausentes, categorias com grafias diferentes, atípicos). Não representam nenhuma empresa. Os achados abaixo descrevem só estes dados.</span>'}
  else b.hidden=true;
}
function renderFilters(){
 $('fList').innerHTML=S.rules.length?S.rules.map((r,k)=>`<div class="chip rule"><div class="tx"><span class="k">Correção confirmada · ${esc(r.action)}</span><span class="v">${esc(r.col)}</span></div><button type="button" data-rm="${k}" aria-label="Revisar remoção desta correção">×</button></div>`).join(''):'<span class="sub">Nenhuma correção de coluna aplicada.</span>';
}
async function addRule(){
 if(!S.original){showMsg('Importe e confirme uma base primeiro.');return}
 const found=E.findColumn(E.uniqueNames(S.headers),$('fCol').value);if(found.err){setFMsg(found.err,true);return}
 const rule={col:found.name,action:$('fAct').value};
 if(S.rules.some(r=>r.col===rule.col&&r.action===rule.action)){setFMsg('Essa correção já foi aplicada.',true);return}
 await reviewCorrection({...S.config,rules:[...S.rules,rule]},'Adicionar correção: '+rule.action+' em '+rule.col);
}
function renderChips(){
  const A=S.A,D=S.D,m=A.metric,pre=A.pre;
  let per='–';
  if(A.trend)per=new Date(A.trend.tmin).toLocaleDateString('pt-BR',{timeZone:'UTC'})+' a '+new Date(A.trend.tmax).toLocaleDateString('pt-BR',{timeZone:'UTC'});
  const ex=[];
  if(A.dup.removed)ex.push(`${nf(A.dup.extra)} duplicatas`);
  if(pre.filterRemoved)ex.push(`${nf(pre.filterRemoved)} linhas vazias`);
  if(pre.dropped.length)ex.push(`${pre.dropped.length} coluna(s)`);
  if(A.cfg.excludeOut&&m&&m.nOut)ex.push(`${nf(m.nOut)} atípicos`);
  const list=[
    ['Arquivo',S.fileName,''],['Linhas lidas',nf(pre.rawN),''],['Colunas',pre.dropped.length?`${D.cols.length} de ${pre.totalCols}`:nf(D.cols.length),''],
    ['Base de cálculo',m?`${nf(A.nUsed)} linhas`:nf(A.base.length)+' linhas','hl'],
    ['Métrica',m?m.name:'(nenhuma)',''],['Exclusões',ex.length?ex.join(' · '):'nenhuma',''],['Período',per,'']
  ];
  $('chips').innerHTML=list.map(([k,v,c])=>`<div class="chip ${c}"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('');
}
function renderView(){
 const labels={insights:'Visão Geral',qualidade:'Qualidade dos Dados',explorar:'Explorar Dados'};
 $('pageTitle').textContent=labels[S.tab];
 document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===S.tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 const view=$('view');view.setAttribute('aria-label',labels[S.tab]);
 if(!S.A){view.innerHTML='<div class="panel empty">Importe sua base para acessar '+labels[S.tab]+'. Nenhum dado será excluído automaticamente.</div>';return}
 view.innerHTML=({insights:vDashboard,qualidade:vQualidade,explorar:vExplorar}[S.tab])();
}
function vExplorar(){return vDados()+`<details class="analysis-section" open><summary>Estatísticas e padrões</summary>${vMetricas()}</details><details class="analysis-section"><summary>Relações entre variáveis</summary>${vRelacoes()}</details><details class="analysis-section"><summary>Metodologia e limitações</summary>${vLimites()}</details>`}

/* ---------- componentes ---------- */
const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
function card(it){
  return `<article class="card"><div class="card-h"><h3>${esc(it.title)}</h3><div class="card-meta"><span class="pill p-${it.prio}"><i></i>Prioridade ${it.prio}</span></div></div>
  <div class="quad">
   <div><span class="tag t-ev">Evidência</span><ul>${li(it.evidence)}</ul></div>
   <div><span class="tag t-fato">Descoberta</span><ul>${li(it.facts)}</ul><span class="tag t-hip" style="margin-top:6px;align-self:flex-start">Interpretação · hipótese não testada</span><ul>${li(it.hyp)}</ul></div>
   <div><span class="tag t-imp">Impacto potencial</span><p>${esc(it.impact)}</p></div>
   <div><span class="tag t-rec">Recomendação</span><p>${esc(it.rec)}</p></div>
  </div>
  <div class="insight-limitation"><b>Limitação:</b> ${esc(it.limitation||'Associação observada apenas nesta base. O contexto de origem, fatores externos e causalidade não foram verificados.')}</div>
  <div class="conf">Suporte amostral (regra prática, não certeza estatística): <b class="muted">${esc(it.conf.lvl)}</b> · ${esc(it.conf.why)}</div></article>`;
}
function vDashboard(){
  const A=S.A,m=A.metric;
  let h=`<section class="executive-kpis" aria-label="Indicadores executivos"><div class="kpi"><span>Registros recebidos</span><b>${nf(A.pre.rawN)}</b><small>Arquivo original</small></div><div class="kpi"><span>Base após limpeza</span><b>${nf(A.base.length)}</b><small>Exclusões detalhadas em Explorar Dados</small></div><div class="kpi"><span>Colunas disponíveis</span><b>${nf(S.D.cols.length)}</b><small>Após os filtros aplicados</small></div><div class="kpi"><span>Alertas de qualidade</span><b>${nf(A.issues.length)}</b><small>Verificações que merecem atenção</small></div></section>`;
  if(m){h+=`<section class="dashboard-charts"><article class="panel stack"><div><span class="eyebrow">Distribuição da métrica</span><h2>${esc(m.name)}</h2><p class="sub">${nf(A.cfg.excludeOut?m.inliers.length:m.allVals.length)} valores válidos${A.cfg.excludeOut?'; atípicos excluídos a pedido':'; atípicos mantidos'}.</p></div>${Charts.histSVG(A.cfg.excludeOut?m.inliers:m.allVals,m.name)}<p class="sub">Fonte: ${esc(S.fileName)} · Frequência por faixa de valor</p></article><article class="panel stack"><div><span class="eyebrow">${A.trend?'Evolução temporal':'Leitura estatística'}</span><h2>${A.trend?esc(m.name)+' por '+A.trend.gran:'Amostra e contexto'}</h2></div>${A.trend?Charts.timeSVG(A.trend,m.name):`<div class="metric-summary"><b>${nf(A.nUsed)}</b><span>registros utilizados na métrica</span></div><p class="muted">Selecione uma coluna de data válida para explorar a evolução temporal.</p>`}<p class="sub">Fonte: ${esc(S.fileName)}${A.trend?' · Soma por período · Barras tracejadas: períodos parciais':''}</p></article></section>`}
  return h+vInsights();
}
function vInsights(){
  const d=S.items.filter(i=>i.sec==='dados'),n=S.items.filter(i=>i.sec==='negocio');
  const obj=$('objective').value.trim();
  let h='';
  if(obj)h+=`<div class="note" style="margin-bottom:14px"><b>Objetivo informado:</b> ${esc(obj)}. O app não direciona a análise por este texto: ele só o registra no relatório.</div>`;
  h+=`<div class="sec-h"><div><h2>Confiabilidade dos dados</h2><p class="sub">O que precisa ser verificado antes de confiar nos números.</p></div></div><div class="cards">${d.length?d.map(card).join(''):'<div class="panel empty">Nenhum problema relevante de qualidade foi encontrado pelas verificações do app. Isso não garante que os dados estejam corretos.</div>'}</div>`;
  h+=`<div class="sec-h" style="margin-top:22px"><div><h2>Achados de negócio</h2><p class="sub">Cada achado separa o que foi medido do que é hipótese.</p></div></div><div class="cards">${n.length?n.map(card).join(''):'<div class="panel empty">Nenhum achado atingiu os critérios mínimos (tamanho de amostra e sinal). Verifique se há uma métrica numérica selecionada e colunas categóricas ou de data.</div>'}</div>`;
  return h;
}
function missBar(p){return `<div class="bar ${p>=.2?'am':''}" data-tip="${pct(p)} ausentes"><span style="width:${Math.min(100,p*100)}%"></span></div>`}
function vQualidade(){
  const A=S.A,D=S.D;
  const totalMiss=A.cols.reduce((s,c)=>s+c.missing,0),cells=A.N*D.cols.length;
  let h=`<div class="panel stack"><h2>Visão geral</h2><div class="kv">
   <div><span>Linhas na base</span><b>${nf(A.N)}</b></div>
   <div><span>Duplicatas ${A.dup.removed?'removidas':'encontradas'}</span><b>${nf(A.dup.extra)} · ${pct(A.dup.pct)}</b></div>
   <div><span>Células ausentes</span><b>${pct(cells?totalMiss/cells:0)}</b></div>
   <div><span>Alertas</span><b>${nf(A.issues.length)}</b></div></div></div>`;
  h+=`<div class="panel" style="margin-top:14px"><h2 style="margin-bottom:10px">Colunas</h2><div class="scroll"><table><thead><tr><th>Coluna</th><th>Tipo inferido</th><th class="r">Preenchido</th><th>Ausentes</th><th class="r">Únicos</th><th>Observações</th></tr></thead><tbody>`+
   A.cols.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td class="muted">${c.type}</td><td class="r">${nf(A.N-c.missing)}</td><td style="min-width:130px">${missBar(c.missingPct)}<span class="faint num" style="font-size:12px">${nf(c.missing)} · ${pct(c.missingPct)}</span></td><td class="r">${nf(c.uniq)}</td><td>${c.notes.map(x=>`<span class="pill p-baixa" style="margin:0 4px 4px 0">${esc(x)}</span>`).join('')||'<span class="faint">–</span>'}</td></tr>`).join('')+`</tbody></table></div></div>`;
  h+=`<div class="panel" style="margin-top:14px"><h2 style="margin-bottom:4px">Alertas por gravidade</h2><p class="sub" style="margin-bottom:8px">Gravidade é uma regra prática do app: depende da proporção de linhas afetadas.</p>`+
   (A.issues.length?A.issues.map(i=>`<div class="issue"><span class="pill p-${i.sev}"><i></i>${i.sev}</span><div><div class="t"><b>${esc(i.col)}</b> · ${esc(i.kind)}</div><div class="w">${esc(i.text)}${i.rows?` · linhas ${i.rows.join(', ')}`:''}</div>${i.variants?i.variants.slice(0,4).map(v=>`<div class="w">${v.forms.map(f=>`"${esc(f.v)}" (${nf(f.n)})`).join(' · ')}</div>`).join(''):''}</div></div>`).join(''):'<div class="empty">Nenhum alerta.</div>')+`</div>`;
  h+=`<div class="panel" style="margin-top:14px"><h2 style="margin-bottom:4px">Valores atípicos por coluna numérica</h2><p class="sub" style="margin-bottom:8px">Regra de Tukey, sobre a base sem duplicatas (se a exclusão estiver ligada). Atípico não significa erro.</p>`+
   (A.outliers.length?`<div class="scroll"><table><thead><tr><th>Coluna</th><th class="r">Cerca inferior</th><th class="r">Cerca superior</th><th class="r">Atípicos</th><th class="r">Extremos (3×)</th><th class="r">Peso na soma</th><th>Maiores (linha)</th></tr></thead><tbody>`+A.outliers.map(o=>`<tr><td><b>${esc(o.col)}</b></td><td class="r">${num(o.f.low)}</td><td class="r">${num(o.f.high)}</td><td class="r">${nf(o.count)} de ${nf(o.n)}</td><td class="r">${nf(o.extreme)}</td><td class="r">${o.shareOfSum==null?'–':pct(o.shareOfSum)}</td><td class="muted">${o.top.map(t=>`${num(t.v)} (${t.row})`).join(', ')}</td></tr>`).join('')+`</tbody></table></div>`:'<div class="empty">Nenhum valor atípico encontrado (ou colunas com menos de 8 valores).</div>')+`</div>`;
  return h;
}
function statsTable(rows){
  return `<div class="scroll"><table><thead><tr><th>Coluna</th><th class="r">n válido</th><th class="r">Ausentes</th><th class="r">Média</th><th class="r">Mediana</th><th class="r">Desvio</th><th class="r">Mín.</th><th class="r">P25</th><th class="r">P75</th><th class="r">P90</th><th class="r">Máx.</th><th class="r">Soma</th></tr></thead><tbody>`+
  rows.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td class="r">${nf(p.n)}</td><td class="r">${nf(p.missing)}</td><td class="r">${num(p.mean)}</td><td class="r">${num(p.median)}</td><td class="r">${num(p.sd)}</td><td class="r">${num(p.min)}</td><td class="r">${num(p.p25)}</td><td class="r">${num(p.p75)}</td><td class="r">${num(p.p90)}</td><td class="r">${num(p.max)}</td><td class="r">${num(p.sum)}</td></tr>`).join('')+`</tbody></table></div>`;
}
function vMetricas(){
  const A=S.A,m=A.metric;let h='';
  h+=`<div class="panel stack"><h2>Amostra utilizada</h2><div class="flow">
   <div class="st"><span>Linhas lidas</span><b>${nf(A.pre.rawN)}</b></div>
   <div class="st"><span>− linhas vazias (filtros)</span><b>${nf(A.pre.filterRemoved)}</b></div>
   <div class="st"><span>− duplicatas ${A.dup.removed?'(removidas)':'(mantidas)'}</span><b>${A.dup.removed?nf(A.dup.extra):'0'}</b></div>
   <div class="st"><span>= base após limpeza</span><b>${nf(A.base.length)}</b></div>
   ${m?`<div class="st"><span>− sem valor em ${esc(m.name)}</span><b>${nf(m.missingInBase)}</b></div><div class="st"><span>− atípicos ${A.cfg.excludeOut?'(excluídos)':'(mantidos)'}</span><b>${A.cfg.excludeOut?nf(m.nOut):'0'}</b></div><div class="st fin"><span>= linhas usadas na métrica</span><b>${nf(A.nUsed)}</b></div>`:''}
  </div>${A.dup.extra&&!A.dup.removed?`<div class="note" style="margin-top:6px">${nf(A.dup.extra)} duplicatas idênticas continuam na base (exclusão desligada).</div>`:''}<p class="sub">As estatísticas por coluna ignoram só os valores ausentes daquela coluna. Colunas de identificador, texto livre e vazias não entram.</p></div>`;
  if(m){
    h+=`<div class="panel stack" style="margin-top:14px"><h2>${esc(m.name)}: com e sem valores atípicos</h2>`+
     statsTable([{name:'Todos os valores',...m.all,missing:m.missingInBase},{name:m.f?'Sem atípicos':'Sem atípicos (não aplicável)',...(m.f?m.clean:m.all),missing:m.missingInBase}])+
     `<h3 style="margin-top:6px">Distribuição</h3>${Charts.histSVG(A.cfg.excludeOut?m.inliers:m.allVals,m.name)}</div>`;
  } else h+=`<div class="panel empty" style="margin-top:14px">Nenhuma coluna numérica selecionada como métrica.</div>`;
  if(A.trend){
    const T=A.trend;
    h+=`<div class="panel stack" style="margin-top:14px"><div><h2>${esc(m.name)} por ${T.gran}</h2><p class="sub">Soma da métrica por período. ${T.nPartial?`Barras tracejadas são períodos parciais e ficam fora da tendência. `:''}${T.future?`${nf(T.future)} registros com data futura ignorados. `:''}Base: ${nf(T.nPts)} registros com data e métrica válidas.</p></div>${Charts.timeSVG(T,m.name)}
     <div class="legend"><span><i style="background:${COL.cyan}"></i>Soma por ${T.gran}</span>${T.fit?`<span><i style="background:${COL.amber}"></i>Reta de tendência (descritiva)</span>`:''}</div>
     ${T.fit?`<div class="kv"><div><span>Períodos completos</span><b>${T.nFull}</b></div><div><span>Inclinação por ${T.gran}</span><b>${T.fit.slope>=0?'+':''}${num(T.fit.slope)}</b></div><div><span>r (IC95%)</span><b>${nf(T.fit.r,2)}${T.fit.ci?` (${nf(T.fit.ci[0],2)} a ${nf(T.fit.ci[1],2)})`:''}</b></div></div>`:`<div class="note">Tendência não calculada: são necessários 6 períodos completos e nenhuma lacuna sem registros.</div>`}</div>`;
  } else if(S.dateName&&m) h+=`<div class="panel" style="margin-top:14px"><div class="note">A série temporal não foi calculada: é preciso ao menos 10 registros com data válida e métrica.</div></div>`;
  for(const g of A.groups){
    const mx=Math.max(...g.list.map(x=>Math.abs(x.mean)),1);
    h+=`<div class="panel stack" style="margin-top:14px"><div><h2>${esc(m.name)} por ${esc(g.dim)}</h2><p class="sub">Grafias são mantidas distintas, a menos que você confirme a correção de unificação. ${g.lost?`${nf(g.lost)} linhas sem valor em "${esc(g.dim)}" ficaram de fora. `:''}Grupos com n &lt; 10 não têm intervalo de confiança.</p></div><div class="scroll"><table><thead><tr><th>Grupo</th><th class="r">n</th><th>Média</th><th class="r">Mediana</th><th class="r">Soma</th><th class="r">% da soma</th><th class="r">IC95% da média</th></tr></thead><tbody>`+
     g.list.map(x=>`<tr><td><b>${esc(x.label)}</b>${x.n<10?' <span class="pill p-baixa">amostra pequena</span>':''}</td><td class="r">${nf(x.n)}</td><td style="min-width:150px"><div class="hb" style="grid-template-columns:1fr auto"><div class="bar" data-tip="${esc(x.label)}: média ${num(x.mean)}"><span style="width:${Math.max(0,x.mean/mx*100)}%"></span></div><span class="num">${num(x.mean)}</span></div></td><td class="r">${num(x.median)}</td><td class="r">${num(x.sum)}</td><td class="r">${x.share==null?'–':pct(x.share)}</td><td class="r">${x.ci?num(x.ci[0])+' a '+num(x.ci[1]):'–'}</td></tr>`).join('')+`</tbody></table></div></div>`;
  }
  if(A.numProfile.length)h+=`<div class="panel stack" style="margin-top:14px"><h2>Todas as colunas numéricas</h2>${statsTable(A.numProfile)}</div>`;
  if(A.catProfile.length)h+=`<div class="panel stack" style="margin-top:14px"><h2>Colunas categóricas: valores mais frequentes</h2><div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">`+A.catProfile.map(c=>`<div class="stack"><h3>${esc(c.name)} <span class="faint" style="font-weight:500">· ${nf(c.distinct)} categorias · n=${nf(c.n)}</span></h3><div class="hbars">${c.top.map(t=>`<div class="hb"><span class="lb" title="${esc(t.label)}">${esc(t.label)}</span><div class="bar" data-tip="${esc(t.label)}: ${nf(t.n)} linhas (${pct(t.share)})"><span style="width:${t.share*100}%;background:${COL.violet}"></span></div><span class="num">${pct(t.share,0)}</span></div>`).join('')}</div></div>`).join('')+`</div></div>`;
  return h;
}
function heatColor(r){const a=Math.min(1,Math.abs(r))*.75;return r>=0?`rgba(85,199,232,${a})`:`rgba(255,190,69,${a})`}
function vRelacoes(){
  const C=S.A.corr;
  let h=`<div class="note" style="margin-bottom:14px"><b>Correlação não é causalidade.</b> Os valores abaixo medem se duas colunas variam juntas nestas linhas. Eles não dizem qual causa a outra, nem se uma delas é calculada a partir da outra.</div>`;
  if(!C)return h+'<div class="panel empty">São necessárias ao menos 2 colunas numéricas com 10 ou mais valores e variação.</div>';
  const n=C.names.length;
  h+=`<div class="panel stack"><div><h2>Matriz de correlação (Spearman)</h2><p class="sub">Spearman usa postos e é menos sensível a atípicos. Cada par usa só as linhas com os dois valores (n por par na tabela abaixo). Cyan: positiva. Âmbar: negativa.</p></div><div class="scroll"><div class="heat" style="grid-template-columns:auto repeat(${n},1fr)"><div></div>${C.names.map(x=>`<div class="h">${esc(x)}</div>`).join('')}`+
   C.names.map((a,i)=>`<div class="rl">${esc(a)}</div>`+C.names.map((b,j)=>i===j?`<div class="c" style="background:var(--panel-2);color:var(--fg-3)">–</div>`:C.M[i][j]?`<div class="c" style="background:${heatColor(C.M[i][j].rs)}" data-tip="${esc(a)} × ${esc(b)}: Spearman ${nf(C.M[i][j].rs,2)} · Pearson ${nf(C.M[i][j].r,2)} · n=${nf(C.M[i][j].n)}">${nf(C.M[i][j].rs,2)}</div>`:`<div class="c faint">n/d</div>`).join('')).join('')+`</div></div></div>`;
  h+=`<div class="panel" style="margin-top:14px"><h2 style="margin-bottom:8px">Pares ordenados por |Spearman|</h2><div class="scroll"><table><thead><tr><th>Par</th><th class="r">n</th><th class="r">Pearson</th><th class="r">IC95% (Pearson)</th><th class="r">Spearman</th><th>Leitura</th></tr></thead><tbody>`+
   C.pairs.slice(0,15).map(p=>{const strong=Math.abs(p.rs)>=.5&&Math.abs(p.r)>=.5&&p.n>=30;const incl=p.ci&&p.ci[0]<=0&&p.ci[1]>=0;return `<tr><td><b>${esc(p.a)}</b> × <b>${esc(p.b)}</b></td><td class="r">${nf(p.n)}</td><td class="r">${nf(p.r,2)}</td><td class="r">${p.ci?nf(p.ci[0],2)+' a '+nf(p.ci[1],2):'–'}</td><td class="r">${nf(p.rs,2)}</td><td class="muted">${Math.abs(p.r-p.rs)>.3?'Pearson e Spearman divergem: atípicos ou relação não linear':strong?'associação forte nestes dados':incl?'indistinguível de zero':Math.abs(p.rs)>=.3?'associação moderada':'associação fraca'}</td></tr>`}).join('')+`</tbody></table></div></div>`;
  return h;
}
function vLimites(){
  const L=I.limitations(S.D,S.A);
  return `<div class="panel stack"><div><h2>Limitações e exclusões</h2><p class="sub">Lista gerada a partir do que foi de fato calculado nesta execução.</p></div><ul class="clean">${li(L)}</ul>${S.notes.length?`<p class="sub">${esc(S.notes.join(' · '))}</p>`:''}</div>`;
}
const HEX=/^#[0-9a-f]{6}$/i;
const SW=[['Cyan','#55C7E8'],['Esmeralda','#35C995'],['Âmbar','#FFBE45'],['Violeta','#7278F5']];
function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function rowAttr(rn){const c=S.rowColors.get(rn);return c?`style="background:${rgba(c,.17)};box-shadow:inset 3px 0 0 ${c}"`:''}
function dotAttr(rn){const c=S.rowColors.get(rn);return c?`class="dot set" style="background:${c}"`:'class="dot"'}
function csvOf(D){const q=v=>{let t=v==null?'':String(v);if(typeof v==='string'&&/^[\s]*[=+@-]/.test(t)&&E.parseNum(t)===null)t="'"+t;return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t};
  return [D.cols.map(c=>q(c.name)).join(';'),...Array.from({length:D.nRows},(_,i)=>D.cols.map(c=>q(c.raw[i])).join(';'))].join('\n')}
function vDados(){
  const D=S.D,A=S.A,pre=A.pre,lim=Math.min(S.dataLimit,D.nRows);
  const rm=[];if(A.dup.removed)rm.push(`${nf(A.dup.extra)} duplicatas`);if(pre.filterRemoved)rm.push(`${nf(pre.filterRemoved)} linhas vazias`);
  let h=`<div class="panel stack"><div><h2>Dados após a limpeza</h2><p class="sub">${nf(D.nRows)} linhas e ${D.cols.length} colunas (lidas: ${nf(pre.rawN)}${rm.length?'; removidas: '+rm.join(', '):''}${pre.dropped.length?'; colunas excluídas: '+esc(pre.dropped.join(', ')):''}). O número à esquerda é a linha do arquivo original. ∅ marca valor ausente. Clique no círculo de uma linha para escolher a cor dela.</p></div>
  <div class="tools"><span class="sub" style="margin:0">Cor das ${nf(lim)} linhas exibidas:</span>${SW.map(([n,c])=>`<button type="button" class="swatch" data-bulk="${c}" style="background:${c}" aria-label="Aplicar ${n} às linhas exibidas" data-tip="${n}"></button>`).join('')}<button type="button" class="swatch def" data-bulk="" aria-label="Voltar as linhas exibidas à cor padrão" data-tip="Cor padrão"></button><button type="button" class="btn" data-clearcolors>Redefinir todas as cores</button><button type="button" class="btn" data-copycsv>Copiar dados limpos (CSV)</button></div>
  <div class="scroll" style="max-height:560px;overflow:auto"><table><thead><tr><th>Cor</th><th class="r">#</th>${D.cols.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>`;
  for(let i=0;i<lim;i++){const rn=D.rowNo[i];
    h+=`<tr data-rn="${rn}" ${rowAttr(rn)}><td class="ctl"><button type="button" ${dotAttr(rn)} data-pick="${rn}" aria-label="Escolher cor da linha ${rn}"></button></td><td class="r faint">${rn}${A.dupNos.has(rn)?' <span class="pill p-baixa">duplicada</span>':''}</td>${D.cols.map(c=>{const v=c.raw[i];const miss=E.isMissing(v);return `<td ${miss?'class="faint"':''}>${miss?'∅':esc(v)}</td>`}).join('')}</tr>`}
  h+=`</tbody></table></div>${lim<D.nRows?`<div class="btns"><button type="button" class="btn" data-more>Mostrar mais ${Math.min(100,D.nRows-lim)} linhas</button><span class="sub" style="align-self:center;margin:0">Exibindo ${nf(lim)} de ${nf(D.nRows)}</span></div>`:''}</div>`;
  return h;
}
function setRowColor(rn,hex){
  if(hex&&HEX.test(hex))S.rowColors.set(rn,hex);else{S.rowColors.delete(rn);hex=''}
  const tr=$('view').querySelector(`tr[data-rn="${rn}"]`);if(!tr)return;
  if(hex)tr.setAttribute('style',`background:${rgba(hex,.17)};box-shadow:inset 3px 0 0 ${hex}`);else tr.removeAttribute('style');
  const d=tr.querySelector('.dot');if(d){d.className=hex?'dot set':'dot';d.style.background=hex||''}
}

/* ---------- eventos ---------- */
const drop=$('drop');
drop.addEventListener('click',()=>$('file').click());
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click()}});
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readFile(f)});
$('file').addEventListener('change',e=>{const f=e.target.files[0];if(f)readFile(f);e.target.value=''});
$('sheetSel').addEventListener('change',e=>loadSheet(e.target.value));
$('sampleBtn').addEventListener('click',loadSample);
$('pasteBtn').addEventListener('click',async()=>{try{const t=$('pasteArea').value;if(new Blob([t]).size>Processor.LIMITS.bytes)throw new Error('O texto ultrapassa 50 MB.');if(!t.trim())throw new Error('Cole os dados com cabeçalho antes de analisar.');const parsed=await work({task:'text',text:t});loadMatrix(parsed.rows,'dados colados',false)}catch(e){showMsg(e.message)}});
['ctx','metricSel','dateSel'].forEach(id=>$(id).addEventListener('change',()=>{
 if(!S.original)return;run({...S.config,ctx:$('ctx').value,metricName:$('metricSel').value,dateName:$('dateSel').value});
}));
$('objective').addEventListener('input',()=>{if(S.D&&S.tab==='insights')renderView()});
async function copyOrShow(text,title,btn){
  const old=btn.textContent;
  try{await navigator.clipboard.writeText(text);btn.textContent='Copiado';setTimeout(()=>{btn.textContent=old},1800);const x=document.getElementById('rep');if(x)x.remove()}
  catch(e){let x=document.getElementById('rep');if(!x){x=document.createElement('div');x.id='rep';x.className='panel report-box';$('view').before(x)}
    x.innerHTML=`<h3>${esc(title)}</h3><p class="sub">Seu navegador bloqueou a cópia automática. Selecione o texto abaixo e copie.</p><textarea id="repTa" style="min-height:220px" readonly></textarea>`;
    const ta=$('repTa');ta.value=text;ta.focus();ta.select()}
}
$('copyBtn').addEventListener('click',()=>{
  if(!S.A)return;
  copyOrShow(I.reportText(S.D,S.A,S.items,{fileName:S.fileName,isSample:S.isSample,objective:$('objective').value.trim()}),'Relatório em texto',$('copyBtn'));
});
/* filtros */
$('fAdd').addEventListener('click',addRule);
$('fCol').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addRule()}});
$('fList').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(!b)return;reviewCorrection({...S.config,rules:S.rules.filter((_,i)=>i!==+b.dataset.rm)},'Remover correção de coluna')});
/* cores por linha */
const pop=$('pop');
function openPop(btn,rn){
  S.popRow=rn;S.popAt=performance.now();pop.hidden=false;$('customColor').value=S.rowColors.get(rn)||'#55C7E8';
  const r=btn.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
  pop.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
  pop.style.top=(r.bottom+8+h>innerHeight?Math.max(8,r.top-h-8):r.bottom+8)+'px';
  pop.querySelector('[data-c]').focus({preventScroll:true});
}
function closePop(){pop.hidden=true;S.popRow=null}
pop.addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b||S.popRow==null)return;setRowColor(S.popRow,b.dataset.c);closePop()});
$('customColor').addEventListener('input',e=>{if(S.popRow!=null)setRowColor(S.popRow,e.target.value)});
document.addEventListener('click',e=>{if(!pop.hidden&&!e.target.closest('#pop')&&!e.target.closest('[data-pick]'))closePop()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden)closePop()});
window.addEventListener('scroll',()=>{if(!pop.hidden&&performance.now()-S.popAt>400)closePop()},{passive:true});
$('view').addEventListener('click',e=>{
  const pk=e.target.closest('[data-pick]');if(pk){openPop(pk,+pk.dataset.pick);return}
  const bk=e.target.closest('[data-bulk]');
  if(bk){const lim=Math.min(S.dataLimit,S.D.nRows);for(const rn of S.D.rowNo.slice(0,lim))setRowColor(rn,bk.dataset.bulk);return}
  if(e.target.closest('[data-clearcolors]')){S.rowColors.clear();renderView();return}
  if(e.target.closest('[data-more]')){S.dataLimit+=100;renderView();return}
  const cp=e.target.closest('[data-copycsv]');if(cp)copyOrShow(csvOf(S.D),'Dados limpos em CSV (separador ;)',cp);
});
const tip=$('tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.classList.remove('on');return}tip.textContent=t.getAttribute('data-tip');tip.classList.add('on')});
document.addEventListener('mousemove',e=>{if(!tip.classList.contains('on'))return;const w=tip.offsetWidth,x=Math.min(e.clientX+14,innerWidth-w-8);tip.style.left=Math.max(8,x)+'px';tip.style.top=(e.clientY+16)+'px'});

$('ctx').innerHTML=Object.entries(I.CTX).map(([k,v])=>`<option value="${k}">${esc(v.nome)}</option>`).join('');
$('metricSel').innerHTML='<option value="">Importe uma base primeiro</option>';
$('dateSel').innerHTML='<option value="">Importe uma base primeiro</option>';
$('importBtn').addEventListener('click',()=>{$('sourceSettings').open=true;$('importSection').scrollIntoView({behavior:'smooth',block:'start'});$('drop').focus({preventScroll:true})});
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{S.tab=b.dataset.nav;renderView();$('pageTitle').focus({preventScroll:true})}));
$('cancelAnalysis').addEventListener('click',()=>cancelWork&&cancelWork());
$('cancelPreview').addEventListener('click',()=>{$('previewDialog').close();S.pending=null;$('exDup').checked=!!S.config.dedupe;$('exOut').checked=!!S.config.excludeOut});
$('previewDialog').addEventListener('cancel',()=>{S.pending=null;$('exDup').checked=!!S.config.dedupe;$('exOut').checked=!!S.config.excludeOut});
$('confirmPreview').addEventListener('click',async()=>{
 const pending=S.pending;if(!pending)return;$('previewDialog').close();S.pending=null;
 if(pending.kind==='import'){
  try{
   const config={rules:[],dedupe:false,excludeOut:false,ctx:$('ctx').value||'geral',metricName:null,dateName:null};
   const result=await work({task:'analyze',source:pending.source,config});
   S.original=freezeSource(pending.source);S.headers=S.original.headers;S.rows=S.original.rows;S.ragged=S.original.ragged;
   S.originalFile=pending.file;S.fileName=pending.name;S.isSample=pending.sample;S.notes=pending.notes;
   S.wb=pending.sheets;S.wbName=pending.file?.name||pending.name;S.activeSheet=pending.sheets?.[pending.sheetIndex]?.name;
   $('sheetWrap').hidden=!pending.sheets||pending.sheets.length<2;
   $('sheetSel').innerHTML=pending.sheets?pending.sheets.map(sh=>`<option>${esc(sh.name)}</option>`).join(''):'';
   if(S.activeSheet)$('sheetSel').value=S.activeSheet;
   S.history=[];S.audit=[];S.rowColors.clear();S.dataLimit=50;S.tab='insights';commitResult(result);$('sourceSettings').open=false;
  }catch(e){showMsg(e.message)}
 }else{
  S.history.push({config:structuredClone(S.config),label:pending.label});
  S.audit.push({label:pending.label,before:S.D.nRows,after:pending.result.D.nRows,colsBefore:S.D.cols.length,colsAfter:pending.result.D.cols.length,removed:pending.removed,returned:pending.returned,delta:pending.delta,time:new Date().toLocaleString('pt-BR')});
  commitResult(pending.result);
 }
});
$('previewOptions').addEventListener('click',()=>reviewCorrection({...S.config,dedupe:$('exDup').checked,excludeOut:$('exOut').checked},'Revisar duplicatas e valores atípicos'));
$('undoBtn').addEventListener('click',async()=>{
 const entry=S.history.at(-1);if(!entry)return;
 try{const result=await work({task:'analyze',source:S.original,config:{...entry.config,ctx:S.ctx,metricName:S.metricName,dateName:S.dateName},before:S.prep});S.history.pop();S.audit.push({label:'Desfazer: '+entry.label,before:S.D.nRows,after:result.D.nRows,colsBefore:S.D.cols.length,colsAfter:result.D.cols.length,removed:result.comparison.removed,returned:result.comparison.returned,delta:result.comparison.delta,time:new Date().toLocaleString('pt-BR')});commitResult(result)}catch(e){showMsg(e.message)}
});
$('restoreBtn').addEventListener('click',()=>reviewCorrection({...S.config,rules:[],dedupe:false,excludeOut:false},'Restaurar a base original'));
function metadata(){return {fileName:S.fileName,isSample:S.isSample,objective:$('objective').value.trim(),notes:S.notes,audit:S.audit,config:S.config}}
$('originalBtn').addEventListener('click',()=>{
 if(S.originalFile)Reports.download(S.originalFile,S.originalFile.name);
 else Reports.exportOriginal(S.original,S.fileName);
});
$('excelBtn').addEventListener('click',async()=>{try{const bytes=await work({task:'excel',source:S.original,D:S.D,A:S.A,items:S.items,meta:metadata()});Reports.download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'nexora-insight-relatorio.xlsx')}catch(e){showMsg('Exportação Excel: '+e.message)}});
$('pdfBtn').addEventListener('click',async()=>{
 try{
  Reports.renderPrint($('printReport'),S.D,S.A,S.items,metadata(),vDashboard()+vQualidade()+vLimites());
  if(window.nexoraDesktop){const result=await window.nexoraDesktop.exportPDF();if(result.error)throw new Error(result.error);if(!result.canceled)showMsg('PDF salvo com sucesso.')}
  else window.print();
 }catch(e){showMsg('Exportação PDF: '+e.message)}
});
renderView();
})();
