/* Pure data pipeline shared by the worker and deterministic tests. */
const Processor=(()=>{
 const E=typeof Engine!=='undefined'?Engine:require('./engine');
 const I=typeof Insights!=='undefined'?Insights:require('./insights');
 const LIMITS={bytes:50*1024*1024,rows:100000,cols:200,cells:2000000};
 function validate(matrix){
  if(!Array.isArray(matrix)||matrix.length<2)throw new Error('O arquivo precisa de cabeçalho e ao menos um registro.');
  if(!matrix[0].length||matrix[0].some(v=>v==null||String(v).trim()===''))throw new Error('Há colunas sem cabeçalho. Nomeie todas as colunas na origem.');
  if(matrix.length-1>LIMITS.rows||matrix[0].length>LIMITS.cols||(matrix.length-1)*matrix[0].length>LIMITS.cells)throw new Error('Limite: 100.000 registros, 200 colunas e 2 milhões de células. Divida a base.');
  if(matrix.some(r=>r.length>matrix[0].length))throw new Error('Há registros com mais campos que o cabeçalho. Confira o delimitador; a base anterior foi preservada.');
  if(!matrix.slice(1).some(r=>r.some(v=>!E.isMissing(v))))throw new Error('A base contém apenas valores ausentes.');
  return {headers:matrix[0].map(String),rows:matrix.slice(1).map(r=>r.slice()),ragged:matrix.slice(1).filter(r=>r.length!==matrix[0].length).length};
 }
 function process(source,config){
  const prep=E.prepare(source.headers,source.rows,source.ragged,{rules:config.rules||[],dedupe:!!config.dedupe,metricName:config.metricName});
  if(!prep.headers.length||!prep.rows.length)throw new Error('Essa correção removeria toda a base. A análise anterior foi preservada.');
  const D=E.buildDataset(prep.headers,prep.rows,prep.ragged,prep.rowNos);
  let metricName=config.metricName,dateName=config.dateName;
  if(metricName!==''&&!D.cols.some(c=>c.name===metricName&&c.type==='numérica')){const nums=D.cols.filter(c=>c.type==='numérica');metricName=(nums.find(c=>/(receita|faturamento|valor|custo|total)/i.test(c.name))||nums[0]||{}).name||'';}
  if(dateName!==''&&!D.cols.some(c=>c.name===dateName&&c.type==='data'))dateName=(D.cols.find(c=>c.type==='data')||{}).name||'';
  const effective={...config,metricName,dateName};
  const A=E.analyze(D,{ctx:config.ctx||'geral',metric:metricName?D.cols.findIndex(c=>c.name===metricName):null,date:dateName?D.cols.findIndex(c=>c.name===dateName):null,excludeDup:!!config.dedupe,excludeOut:!!config.excludeOut,pre:prep.pre});
  return {D,A,prep,items:I.build(D,A),config:effective};
 }
 function compare(before,after){
  const beforeRows=new Map(before.rowNos.map((n,i)=>[n,i])),next=new Set(after.rowNos);
  const removed=before.rowNos.filter(n=>!next.has(n)),returned=after.rowNos.filter(n=>!beforeRows.has(n));
  const oldCols=new Map(before.headers.map((h,i)=>[h,i]));let delta=0;
  for(let i=0;i<after.rows.length;i++){
   const oldIndex=beforeRows.get(after.rowNos[i]);if(oldIndex===undefined)continue;
   for(let j=0;j<after.headers.length;j++){const k=oldCols.get(after.headers[j]);if(k!==undefined&&before.rows[oldIndex][k]!==after.rows[i][j])delta++}
  }
  return {removed,returned,delta};
 }
 return {validate,process,compare,LIMITS};
})();
if(typeof module!=='undefined')module.exports=Processor;
