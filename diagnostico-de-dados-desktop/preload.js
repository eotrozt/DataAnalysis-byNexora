'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nexoraDesktop',Object.freeze({exportPDF:()=>ipcRenderer.invoke('nexora:export-pdf')}));
