'use strict';
const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#171B20',
    title: 'Nexora Insight',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname,'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // O app trabalha só com arquivos locais. Qualquer link externo abre no navegador padrão.
  const openExternal = (url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) { event.preventDefault(); openExternal(url); }
  });
}

app.whenReady().then(() => {
  ipcMain.handle('nexora:export-pdf',async(event)=>{
    const win=BrowserWindow.fromWebContents(event.sender);
    if(!win||event.sender.getURL()!==require('url').pathToFileURL(path.join(__dirname,'app','index.html')).href)return {error:'Origem de exportação inválida.'};
    try{
      const selection=await dialog.showSaveDialog(win,{title:'Salvar relatório Nexora Insight',defaultPath:'Nexora Insight.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
      if(selection.canceled||!selection.filePath)return {canceled:true};
      const pdf=await event.sender.printToPDF({printBackground:true,preferCSSPageSize:true});
      await require('fs/promises').writeFile(selection.filePath,pdf);
      return {canceled:false};
    }catch{return {error:'Não foi possível salvar o PDF. Confira o destino e as permissões.'}}
  });
  // No Windows e no Linux o menu fica oculto. No macOS ele é mantido (atalhos de copiar e colar dependem dele).
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
