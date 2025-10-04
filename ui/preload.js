const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 参考文献管理
  readReferencesDir: () => ipcRenderer.invoke('read-references-dir'),
  openReference: (reference) => ipcRenderer.invoke('open-reference', reference),
  
  // 报告导出
  exportReport: (reportData) => ipcRenderer.invoke('export-report', reportData),
  selectExportDirectory: () => ipcRenderer.invoke('select-export-directory'),
  
  // 事件监听
  onExportReport: (callback) => ipcRenderer.on('export-report', callback),
  onShowHelp: (callback) => ipcRenderer.on('show-help', callback),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// 暴露版本信息
contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron
});