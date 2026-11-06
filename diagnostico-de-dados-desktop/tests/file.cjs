/* Exercise file:// without the desktop preload: same runtime path as a downloaded HTML. */
const {_electron}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const appRoot=process.env.NEXORA_FILE_APP||path.resolve(__dirname,'../app');
(async()=>{
 const app=await _electron.launch({args:[path.resolve(__dirname,'..'),'--no-sandbox','--ozone-platform=headless','--disable-gpu']});
 try{
  const originalWindow=await app.firstWindow();await originalWindow.waitForLoadState('load');
  const windowPromise=app.waitForEvent('window');
  await app.evaluate(async({BrowserWindow},file)=>{
   const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
   await win.loadFile(file);
  },path.join(appRoot,'index.html'));
  const page=await windowPromise;await page.waitForLoadState('load');
  const errors=[],workers=[];page.on('pageerror',e=>errors.push(e.message));page.on('worker',w=>workers.push(w.url()));
  assert.equal(await page.evaluate(()=>location.protocol),'file:');
  assert.equal(await page.evaluate(()=>typeof window.nexoraDesktop),'undefined');
  await page.locator('#file').setInputFiles({name:'dados.csv',mimeType:'text/csv',buffer:Buffer.from('categoria;valor\nA;10\nB;20\nB;20')});
  await page.locator('#previewDialog[open]').waitFor();await page.locator('#confirmPreview').click();
  await page.waitForFunction(()=>document.querySelector('.kpi b')?.textContent==='3');
  assert.equal(await page.locator('.kpi b').nth(1).textContent(),'3');
  await page.locator('#importBtn').click();await page.locator('#exDup').check();await page.locator('#previewOptions').click();await page.locator('#previewDialog[open]').waitFor();await page.locator('#confirmPreview').click();
  await page.waitForFunction(()=>document.querySelectorAll('.kpi b')[1]?.textContent==='2');
  await page.evaluate(()=>{Reports.download=async(blob)=>{window.exportedBytes=Array.from(new Uint8Array(await blob.arrayBuffer()))}});
  await page.locator('#excelBtn').click();await page.waitForFunction(()=>Array.isArray(window.exportedBytes)||!document.querySelector('#msg').hidden);
  assert(await page.evaluate(()=>Array.isArray(window.exportedBytes)),await page.locator('#msg').textContent());
  const report=XLSX.read(Buffer.from(await page.evaluate(()=>window.exportedBytes)),{type:'buffer'});assert.equal(XLSX.utils.sheet_to_json(report.Sheets.Original,{header:1}).length,4);
  assert.equal(XLSX.utils.sheet_to_json(report.Sheets['Base analisada'],{header:1}).length,3);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['valor','grupo'],[4,'X'],[6,'Y']]),'Aba');
  await page.locator('#file').setInputFiles({name:'arquivo.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});
  await page.locator('#previewDialog[open]').waitFor();await page.locator('#confirmPreview').click();
  await page.waitForFunction(()=>document.querySelector('#datasetStatus').textContent.includes('arquivo.xlsx'));
  assert(workers.length>=5);assert(workers.every(url=>url.startsWith('blob:')));assert.deepEqual(errors,[]);
  // All imports must be embedded, including the Excel reader and report builder.
  const generated=fs.readFileSync(path.join(appRoot,'worker-source.js'),'utf8');assert(!generated.includes('importScripts('));
  console.log('PASS: file:// without desktop bridge uses Blob workers for CSV import, analysis, correction, Excel export and Excel import. Security settings retained.');
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
