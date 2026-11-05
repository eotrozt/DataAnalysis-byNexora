/* All imports are local; no remote analysis services. */
importScripts('engine.js','insights.js','processor.js');
self.onmessage=({data})=>{try{
 let result;
 if(data.task==='analyze'){result=Processor.process(data.source,data.config);if(data.before)result.comparison=Processor.compare(data.before,result.prep);}
 else if(data.task==='text')result=Engine.parseCSV(data.text);
 else if(data.task==='workbook'){
  importScripts('vendor/xlsx.full.min.js');
  const wb=XLSX.read(new Uint8Array(data.bytes),{type:'array',cellDates:true});
  result=wb.SheetNames.map(name=>{
   const sheet=wb.Sheets[name],ref=sheet['!ref'];
   if(ref){const range=XLSX.utils.decode_range(ref);if(range.e.r>=Processor.LIMITS.rows+1||range.e.c>=Processor.LIMITS.cols||(range.e.r+1)*(range.e.c+1)>Processor.LIMITS.cells)throw new Error('Planilha excede os limites de 100.000 registros, 200 colunas ou 2 milhões de células.');}
   const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null,blankrows:true}).map(r=>r.map(v=>v instanceof Date?v.toISOString().slice(0,10):v));
   return {name,matrix};
  });
 }else if(data.task==='excel'){importScripts('vendor/xlsx.full.min.js','reports.js');result=XLSX.write(Reports.workbook(XLSX,data.source,data.D,data.A,data.items,data.meta),{type:'array',bookType:'xlsx'});}else throw new Error('Operação desconhecida.');
 self.postMessage({result});
}catch(e){self.postMessage({error:e.message||'Falha ao processar a base.'})}};
