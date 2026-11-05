const {test}=require('node:test');const assert=require('node:assert/strict');
const E=require('../app/engine');const P=require('../app/processor');const R=require('../app/reports');const XLSX=require('xlsx');
const config={rules:[],dedupe:false,excludeOut:false,ctx:'geral',metricName:null,dateName:null};
const fixture=()=>P.validate([['valor','grupo'],['10','A'],['20','B'],['20','B'],['',' C ']]);
test('CSV preserves quoted separators, newlines, escapes and Brazilian numbers',()=>{
 const p=E.parseCSV('nome;valor\r\n"a,b,c";"1.234,56"\r\n"linha\n""dupla""";20');assert.equal(p.delim,';');assert.equal(p.rows[2][0],'linha\n"dupla"');assert.equal(E.parseNum(p.rows[1][1]),1234.56);assert.throws(()=>E.parseCSV('a;b\n"open;2'),/aspas/);
});
test('empty files, missing columns, oversized structure and no data are rejected',()=>{
 for(const x of [[],[['a']], [['','b'],[1,2]],[['a'],[1,2]],[['a'],['']]])assert.throws(()=>P.validate(x));
 assert.throws(()=>P.validate([Array(201).fill('x'),Array(201).fill(1)]),/Limite/);
});
test('repeated and prototype-like headers get unique safe names',()=>assert.deepEqual(E.uniqueNames(['a','a','a_2','__proto__','__proto__']),['a','a_2','a_2_2','__proto__','__proto___2']));
test('no automatic removals; strict duplicates only; original is never mutated',()=>{
 const source=fixture(),snapshot=JSON.stringify(source);source.rows.forEach(Object.freeze);Object.freeze(source.rows);
 const before=P.process(source,config);assert.equal(before.D.nRows,4);assert.equal(before.A.dup.extra,1);
 const after=P.process(source,{...config,dedupe:true});assert.equal(after.D.nRows,3);assert.deepEqual(after.prep.pre.removedRows,[4]);
 const strict=P.process(P.validate([['a'],[' x'],['x'],['a\u0001b']]),{...config,dedupe:true});assert.equal(strict.D.nRows,3);
 assert.equal(JSON.stringify(source),snapshot);assert.equal(P.process(source,config).D.nRows,4);
});
test('explicit corrections track cells and original row numbers; restoration replays source',()=>{
 const source=fixture();const after=P.process(source,{...config,rules:[{col:'grupo',action:'trim'},{col:'valor',action:'empty'}]});
 assert.equal(after.D.nRows,3);assert.deepEqual(after.prep.pre.removedRows,[5]);assert.deepEqual(after.prep.pre.changes,[{row:5,col:'grupo',before:' C ',after:'C'}]);assert.equal(source.rows[3][1],' C ');
 assert.throws(()=>P.process(source,{...config,rules:[{col:'valor',action:'drop'},{col:'grupo',action:'drop'}]}),/toda a base/);
 assert.throws(()=>P.process(source,{...config,rules:[{col:'missing',action:'drop'}]}),/não encontrada/);
});
test('means, median and sample standard deviation use valid values and effective base',()=>{
 const result=P.process(fixture(),config);assert.equal(result.A.metric.all.mean,50/3);assert.equal(result.A.metric.all.median,20);assert.equal(result.A.nUsed,3);assert(Math.abs(E.describe([10,20,30]).sd-10)<1e-9);
 const after=P.process(fixture(),{...config,dedupe:true});assert.equal(after.A.metric.all.mean,15);assert.equal(after.A.nUsed,2);
});
test('category normalization is opt-in',()=>{
 const source=P.validate([['grupo','valor'],['Sul',1],['SUL ',2],['Norte',3],['Sul',4]]);
 const before=P.process(source,config);assert.equal(before.A.catProfile[0].distinct,3);
 const after=P.process(source,{...config,rules:[{col:'grupo',action:'normalize'}]});assert.equal(after.A.catProfile[0].distinct,2);assert.equal(source.rows[1][0],'SUL ');
});
test('missing time periods are null; no zero fabrication or trend fitted across gaps',()=>{
 const rows=[['data','valor']];for(let month=1;month<=10;month++){if(month===5)continue;for(let d of [1,15,28])rows.push([`2025-${String(month).padStart(2,'0')}-${d}`,month%2?-10:20]);}
 const {A}=P.process(P.validate(rows),config);assert(A.trend.empty>0);assert(A.trend.periods.some(p=>p.n===0&&p.sum===null));assert.equal(A.trend.fit,undefined);
});
test('Excel contains original, effective metric base, changes, methodology and literal formulas',()=>{
 const source=P.validate([['valor','grupo'],[10,'=1+1'],[10,'=1+1'],[20,'A']]);const result=P.process(source,{...config,dedupe:true});
 const book=R.workbook(XLSX,source,result.D,result.A,result.items,{fileName:'original.csv',config:result.config,audit:[]});
 const reopened=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.equal(reopened.Sheets.Original.B2.t,'s');assert.equal(reopened.Sheets.Original.B2.v,'=1+1');assert(!reopened.Sheets.Original.B2.f);
 assert.equal(XLSX.utils.sheet_to_json(reopened.Sheets.Original,{header:1}).length,4);
 assert.equal(XLSX.utils.sheet_to_json(reopened.Sheets['Base analisada'],{header:1}).length,3);
 for(const sheet of ['Qualidade','Metodologia','Descobertas','Histórico','Células alteradas','Registros afetados','Base da métrica'])assert(reopened.Sheets[sheet]);
});
test('large sheet: 20000 rows produce exact statistics and leave source intact',()=>{
 const matrix=[['quantidade','categoria'],...Array.from({length:20000},(_,i)=>[i+1,'grupo '+i%4])];const source=P.validate(matrix);const result=P.process(source,config);
 assert.equal(result.A.metric.all.sum,20000*20001/2);assert.equal(result.A.metric.all.mean,10000.5);assert.equal(source.rows.length,20000);assert.equal(source.rows[19999][0],20000);
});
test('numeric identifiers stay out of metrics even with duplicate IDs',()=>{
 const source=P.validate([['id','prazo'],[1,10],[1,20],[2,30],[2,40]]);const {D,A}=P.process(source,config);
 assert.equal(D.cols[0].type,'id');assert.equal(A.metric.name,'prazo');assert.equal(A.dupId.conflict,2);
});
test('dropped columns with renamed duplicate headers remain recoverable in the report',()=>{
 const source=P.validate([['valor','valor'],[10,20],[30,40]]);const result=P.process(source,{...config,rules:[{col:'valor_2',action:'drop'}]});
 const sheets=R.sheets(source,result.D,result.A,result.items,{fileName:'duplicado.csv',config:result.config});assert.deepEqual(sheets['Colunas excluídas'][1],['valor_2',2,20]);
});
