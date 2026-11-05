/* Report data is independent of the view and reused by the Excel worker/tests. */
const Reports=(()=>{
 const E=typeof Engine!=='undefined'?Engine:require('./engine');
 const I=typeof Insights!=='undefined'?Insights:require('./insights');
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function sheets(source,D,A,items,meta){
  const config=meta.config||{};
  const summary=[['Nexora Insight','Relatório analítico'],['Arquivo',meta.fileName],['Base',meta.isSample?'Exemplo sintético':'Arquivo importado'],['Objetivo',meta.objective||'Não informado'],['Contexto',(I.CTX[A.cfg.ctx]||I.CTX.geral).nome],['Registros originais',source.rows.length],['Registros após correções',D.nRows],['Registros na métrica',A.nUsed],['Métrica',A.metric?.name||'Não selecionada'],['Duplicatas',config.dedupe?'Remoção confirmada':'Mantidas'],['Atípicos',config.excludeOut?'Excluídos de grupos e tendência a pedido':'Mantidos'],['Original','Preservado; Original contém valores importados. Para fórmulas e formatação do arquivo recebido, use Baixar original.']];
  const keep=new Set(D.rowNo),used=new Set(A.mrows.map(r=>D.rowNo[r.i]));
  const rowData=(indices)=>[['Linha original',...D.cols.map(c=>c.name)],...indices.map(i=>[D.rowNo[i],...D.cols.map(c=>c.raw[i]??null)])];
  return {
   'Resumo':summary,
   'Original':[source.headers,...source.rows],
   'Base analisada':rowData(Array.from({length:D.nRows},(_,i)=>i)),
   'Base da métrica':rowData(A.mrows.map(r=>r.i)),
   'Estatísticas':[['Coluna','n válido','Ausentes','Média','Mediana','Desvio amostral','Mínimo','Máximo','Soma'],...A.numProfile.map(p=>[p.name,p.n,p.missing,p.mean,p.median,p.sd,p.min,p.max,p.sum])],
   'Qualidade':[['Coluna','Tipo','Ausentes','Proporção ausente'],...A.cols.map(c=>[c.name,c.type,c.missing,c.missingPct]),[],['Coluna','Alerta','Gravidade','Registros afetados','Descrição'],...A.issues.map(i=>[i.col,i.kind,i.sev,i.count,i.text])],
   'Descobertas':[['Descoberta','Evidência','Interpretação (hipótese)','Recomendação','Limitação','Suporte amostral'],...items.map(it=>[it.title,it.evidence.join('\n'),it.hyp.join('\n'),it.rec,it.limitation||'Causalidade e contexto externo não verificados.',it.conf.why])],
   'Metodologia':[['Filtros e limitações'],...I.limitations(D,A).map(x=>[x]),...(config.rules||[]).map(r=>['Correção: '+r.action+' · '+r.col]),...(meta.notes||[]).map(n=>[n])],
   'Histórico':[['Operação','Data','Registros antes','Depois','Colunas antes','Depois','Células modificadas','Linhas removidas','Linhas restauradas'],...(meta.audit||[]).map(h=>[h.label,h.time,h.before,h.after,h.colsBefore,h.colsAfter,h.delta,(h.removed||[]).slice(0,100).join(', '),(h.returned||[]).slice(0,100).join(', ')])],
   'Registros afetados':[['Linha original','Situação',...source.headers],...source.rows.flatMap((r,i)=>!keep.has(i+2)?[[i+2,'Removida da base',...r]]:A.metric&&!used.has(i+2)?[[i+2,'Fora da métrica (ausente, inválido ou atípico excluído)',...r]]:[])],
   'Colunas excluídas':[['Coluna','Linha original','Valor'],...(A.pre.dropped||[]).flatMap(name=>{const index=E.uniqueNames(source.headers).indexOf(name);return source.rows.map((r,i)=>[name,i+2,r[index]??null])})],
   'Células alteradas':[['Linha original','Coluna','Antes','Depois'],...(A.pre.changes||[]).map(c=>[c.row,c.col,c.before,c.after])]
  };
 }
 function workbook(XLSX,source,D,A,items,meta){
  const book=XLSX.utils.book_new();
  for(const [name,rows]of Object.entries(sheets(source,D,A,items,meta))){
   // Strings remain literal cells, never formulas, even when starting with =, +, - or @.
   const sheet=XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(v=>typeof v==='number'&&!Number.isFinite(v)?null:v)));
   sheet['!cols']=rows[0].map(()=>({wch:24}));
   XLSX.utils.book_append_sheet(book,sheet,name);
  }
  return book;
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function exportOriginal(source,name){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([source.headers,...source.rows]),'Original');download(new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})]),name.replace(/\.[^.]*$/,'')+'-original.xlsx')}
 function renderPrint(target,D,A,items,meta,content){
  target.hidden=false;
  const notices=meta.isSample?'<p class="note">EXEMPLO SINTÉTICO — não representa uma empresa.</p>':'';
  const summary=items.slice(0,5).map(it=>`<li><b>${escape(it.title)}</b>: ${escape(it.evidence[0]||'')}<br>Próxima ação: ${escape(it.rec)}</li>`).join('');
  target.innerHTML=`<header class="report-heading"><span>NEXORA INSIGHT</span><h1>Diagnóstico de dados</h1><p>${escape(meta.fileName)} · ${new Date().toLocaleDateString('pt-BR')}</p><p>Contexto: ${escape((I.CTX[A.cfg.ctx]||I.CTX.geral).nome)} · Objetivo: ${escape(meta.objective||'Não informado')}</p></header>${notices}<section class="panel"><h2>Resumo executivo</h2><p>${A.pre.rawN} registros recebidos; ${D.nRows} na base após correções; ${A.nUsed} válidos na métrica ${escape(A.metric?.name||'(não selecionada)')}. O original permanece preservado.</p><ul>${summary||'<li>Não há achados que atendam aos critérios mínimos da análise.</li>'}</ul></section>${content}<section class="panel"><h2>Transformações e metodologia</h2><p>Duplicatas: ${A.cfg.excludeDup?'exclusão confirmada':'mantidas'}. Atípicos: ${A.cfg.excludeOut?'excluídos de grupos e tendência':'mantidos'}.</p><ul>${(meta.config.rules||[]).map(r=>`<li>${escape(r.action)}: ${escape(r.col)}</li>`).join('')||'<li>Nenhuma correção de coluna.</li>'}</ul><p>Linhas removidas da base: ${(A.pre.removedRows||[]).slice(0,50).join(', ')||'nenhuma'}${(A.pre.removedRows||[]).length>50?'… (lista completa no Excel)':''}</p><ul>${(meta.notes||[]).map(n=>`<li>${escape(n)}</li>`).join('')}</ul></section><footer>Nexora Insight · Processamento local · Os resultados descrevem a base e não demonstram causalidade.</footer>`;
 }
 return {sheets,workbook,download,exportOriginal,renderPrint};
})();
if(typeof module!=='undefined')module.exports=Reports;
