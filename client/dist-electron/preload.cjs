"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => electron_1.ipcRenderer.invoke('ping'),
    loadConfig: () => electron_1.ipcRenderer.invoke('load-config'),
    saveConfig: (config) => electron_1.ipcRenderer.invoke('save-config', config),
    selectExportDirectory: () => electron_1.ipcRenderer.invoke('select-export-directory'),
    exportReport: (payload) => electron_1.ipcRenderer.invoke('export-report', payload),
    downloadReference: (payload) => electron_1.ipcRenderer.invoke('references:download', payload),
    exportReportWithPdf: (payload) => electron_1.ipcRenderer.invoke('export-report-with-pdf', payload),
});
//# sourceMappingURL=preload.cjs.map