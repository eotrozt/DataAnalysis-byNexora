const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const appRoot=path.resolve(__dirname,'../app');
const server=http.createServer((req,res)=>{
  const file=path.resolve(appRoot,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(appRoot+path.sep)){res.writeHead(403).end();return}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2'};
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data)});
});
let browser;
(async()=>{
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message)});
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);console.log('Loaded app');
const url=`http://127.0.0.1:${server.address().port}/index.html`;
const ready=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden);
const confirm=async()=>{console.log('Confirm preview');await page.locator('#confirmPreview').click();await ready();};
const count=async(value)=>page.waitForFunction(v=>document.querySelector('.kpi b')?.textContent===v,Number(value).toLocaleString('pt-BR'));
const screenshot=async(name)=>{if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,name),fullPage:false})};
assert.equal(await page.locator('#loginScreen').count(),0);assert.equal(await page.locator('[role=tablist]').count(),0);assert.equal(await page.locator('[data-nav]').count(),3);
assert(await page.locator('#welcome').isVisible());assert(!await page.locator('#exDup').isChecked());
console.log('Import sample');await page.locator('#sampleBtn').click();await page.locator('#previewDialog[open]').waitFor();assert.equal(await page.locator('.kpi').count(),0);
await confirm();await count(509);assert(await page.locator('#banner').isVisible());
for(const key of ['qualidade','explorar','insights'])await page.locator(`[data-nav="${key}"]`).click();await count(509);
await screenshot('nexora-dashboard.png');
await page.locator('#importBtn').click();await page.locator('details.paste summary').click();
const original='data;receita;categoria\n01/01/2025;100;A\n02/01/2025;200;B\n03/01/2025;150;A\n03/01/2025;150;A';
await page.locator('#pasteArea').fill(original);await page.locator('#pasteBtn').click();await page.locator('#previewDialog[open]').waitFor();
await page.locator('#cancelPreview').click();await count(509);
await page.locator('#pasteBtn').click();await page.locator('#previewDialog[open]').waitFor();await confirm();await count(4);
assert.equal(await page.locator('.kpi b').nth(1).textContent(),'4');assert(!await page.locator('#banner').isVisible());
await page.locator('#importBtn').click();await page.locator('#exDup').check();await page.locator('#previewOptions').click();await page.locator('#previewDialog[open]').waitFor();
assert((await page.locator('#previewBody').textContent()).includes('4 → 3'));assert.equal(await page.locator('.kpi b').nth(1).textContent(),'4');
await confirm();assert.equal(await page.locator('.kpi b').nth(1).textContent(),'3');
for(const key of ['qualidade','explorar','insights'])await page.locator(`[data-nav="${key}"]`).click();assert.equal(await page.locator('.kpi b').nth(1).textContent(),'3');
await page.locator('#undoBtn').click();await ready();assert.equal(await page.locator('.kpi b').nth(1).textContent(),'4');
await page.locator('#fCol').fill('categoria');await page.locator('#fAct').selectOption('drop');await page.locator('#fAdd').click();await page.locator('#previewDialog[open]').waitFor();await confirm();assert.equal(await page.locator('.kpi b').nth(2).textContent(),'2');
await page.locator('#restoreBtn').click();await page.locator('#previewDialog[open]').waitFor();await confirm();assert.equal(await page.locator('.kpi b').nth(2).textContent(),'3');assert.equal(await page.locator('.kpi b').nth(1).textContent(),'4');
// Bad imports never replace the active dataset.
for(const invalid of ['', ';coluna\n1;2', 'a;b\n"open;2', 'a;b\n1;2;3']){
 await page.locator('#pasteArea').fill(invalid);await page.locator('#pasteBtn').click();await ready();assert(await page.locator('#msg').isVisible());await count(4);
}
// Literal values and non-financial contexts survive Excel import and export.
const XLSX=require('xlsx');const book=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['prazo','grupo'],[10,'=1+1'],[20,'B']]),'Primeira');
XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['prazo','grupo'],[30,'C']]),'Segunda');
const buffer=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
await page.locator('#file').setInputFiles({name:'teste.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
await page.locator('#previewDialog[open]').waitFor();await confirm();await count(2);
await page.locator('#importBtn').click();await page.locator('#ctx').selectOption('advocacia');await ready();
const originalDownload=page.waitForEvent('download');await page.locator('#originalBtn').click();const originalSaved=await originalDownload;assert.deepEqual(fs.readFileSync(await originalSaved.path()),buffer);
const excelDownload=page.waitForEvent('download');await page.locator('#excelBtn').click();const excel=await excelDownload;
const report=XLSX.readFile(await excel.path());assert(report.Sheets['Metodologia']);assert.equal(report.Sheets.Original.B2.v,'=1+1');assert.equal(report.Sheets.Original.B2.f,undefined);
assert(XLSX.utils.sheet_to_json(report.Sheets.Resumo,{header:1}).some(r=>r.includes('Advocacia')));
// Print CSS and generated PDF must contain the report, not the workspace.
await page.evaluate(()=>{window.print=()=>{window.printRequested=true}});await page.locator('#pdfBtn').click();assert(await page.evaluate(()=>window.printRequested));
await page.emulateMedia({media:'print'});assert(!await page.locator('#appShell').isVisible());assert(await page.locator('#printReport').isVisible());
const pdf=await page.pdf({format:'A4',printBackground:true});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>10000);
const pdfPath=path.join(require('os').tmpdir(),'nexora-test-report.pdf');fs.writeFileSync(pdfPath,pdf);
const extracted=require('child_process').spawnSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});if(extracted.status===0){assert(extracted.stdout.includes('NEXORA INSIGHT'));assert(extracted.stdout.includes('Resumo executivo'));assert(extracted.stdout.includes('Metodologia')||extracted.stdout.includes('metodologia'))}
await page.emulateMedia({media:'screen'});
await page.locator('#sheetSel').selectOption('Segunda');await page.locator('#previewDialog[open]').waitFor();await confirm();await count(1);
await page.setViewportSize({width:390,height:844});await screenshot('nexora-mobile.png');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
// The worker yields to the UI even during a representative large import.
await page.setViewportSize({width:1440,height:1050});await page.locator('#importBtn').click();
const large='quantidade;grupo\n'+Array.from({length:20000},(_,i)=>`${i+1};grupo ${i%4}`).join('\n');
await page.locator('#file').setInputFiles({name:'grande.csv',mimeType:'text/csv',buffer:Buffer.from(large)});
await page.locator('#previewDialog[open]').waitFor();await page.evaluate(()=>{window.framesWhileBusy=0;function frame(){if(!document.querySelector('#busy').hidden)window.framesWhileBusy++;requestAnimationFrame(frame)}requestAnimationFrame(frame)});
await confirm();await count(20000);assert(await page.evaluate(()=>window.framesWhileBusy>0));
assert.equal(await page.locator('#ctx').inputValue(),'advocacia');
assert.deepEqual(errors,[]);console.log('PASS: direct access, preview/cancel, 3 sections, no auto-cleaning, corrections, undo/restore, invalid imports, original bytes intact, Excel export, PDF generation, multiple sheets, mobile and 20000-row worker responsiveness.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
