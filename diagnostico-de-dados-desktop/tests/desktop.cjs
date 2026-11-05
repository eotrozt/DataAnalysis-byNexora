const {_electron}=require('playwright');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const app=await _electron.launch({args:[path.resolve(__dirname,'..'),'--no-sandbox','--ozone-platform=headless','--disable-gpu'],timeout:15000});
 try{
  const page=await app.firstWindow();
  assert.equal(await page.title(),'Nexora Insight');
  assert(await page.evaluate(()=>typeof window.require==='undefined'));
  await page.locator('#sampleBtn').click();
  await page.locator('#previewDialog[open]').waitFor();
  await page.locator('#confirmPreview').click();
  await page.waitForFunction(()=>!!document.querySelector('.kpi'));
  const output=path.join(os.tmpdir(),'nexora-electron-report.pdf');
  // Bypass only the OS picker; render and save through the real preload/IPC path.
  await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath})},output);
  await page.locator('#pdfBtn').click();
  await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('PDF salvo'));
  const pdf=fs.readFileSync(output);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>10000);
  console.log('PASS: Electron file loading, isolated renderer, local worker, real PDF export via preload and IPC.');
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
