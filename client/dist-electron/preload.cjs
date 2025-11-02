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
    // 新增：部署相关 API
    startDeployment: (payload) => electron_1.ipcRenderer.invoke('start-deployment', payload),
    checkDockerEnvironment: (config) => electron_1.ipcRenderer.invoke('check-docker-environment', config),
    // 监听部署进度
    onDeployProgress: (callback) => {
        electron_1.ipcRenderer.on('deploy-progress', callback);
        // 返回取消监听的函数
        return () => electron_1.ipcRenderer.removeListener('deploy-progress', callback);
    },
    // Window control APIs
    windowMinimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    windowMaximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    windowClose: () => electron_1.ipcRenderer.invoke('window:close'),
    windowIsMaximized: () => electron_1.ipcRenderer.invoke('window:isMaximized'),
    // Developer tools API
    openDevTools: () => electron_1.ipcRenderer.invoke('open-dev-tools'),
});
//# sourceMappingURL=preload.cjs.map