const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let isDev = process.argv.includes('--dev');

class ResearchAssistantApp {
  constructor() {
    this.config = null;
    this.configPath = path.join(__dirname, 'config.json');
    this.defaultConfig = {
      websocketUrl: 'ws://localhost:8080',
      apiKey: '',
      exportDirectory: path.join(__dirname, 'exports'),
      theme: 'light'
    };
  }

  async initialize() {
    await this.loadConfig();
    await this.createWindow();
    this.setupIPC();
    this.createApplicationMenu();
  }

  async createWindow() {
    mainWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false // 允许加载本地资源
      },
      titleBarStyle: 'default',
      show: false // 初始不显示，等准备好再显示
    });

    // 加载应用
    mainWindow.loadFile('src/index.html');

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });

    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    // 处理窗口关闭
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  createApplicationMenu() {
    const template = [
      {
        label: '文件',
        submenu: [
          {
            label: '导出报告',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('export-report');
              }
            }
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' }
        ]
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'forceReload', label: '强制重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '切换全屏' }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('show-help');
              }
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupIPC() {
    // 配置管理
    ipcMain.handle('get-config', async () => {
      return await this.loadConfig();
    });

    ipcMain.handle('save-config', async (event, config) => {
      return await this.saveConfig(config);
    });

    // 文件操作
    ipcMain.handle('select-export-directory', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择报告导出目录'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, directory: result.filePaths[0] };
      }
      return { success: false, error: '未选择目录' };
    });

    // 参考文献管理
    ipcMain.handle('read-references-dir', async () => {
      try {
        const refDir = path.join(__dirname, 'references');
        
        try {
          await fs.access(refDir);
        } catch {
          await fs.mkdir(refDir, { recursive: true });
          return [];
        }
        
        const files = await fs.readdir(refDir);
        const references = [];
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = await fs.readFile(path.join(refDir, file), 'utf8');
              const refData = JSON.parse(content);
              refData.id = path.basename(file, '.json');
              refData.local_file = refData.file_path || refData.local_file;
              references.push(refData);
            } catch (error) {
              console.error(`读取文件 ${file} 出错:`, error);
            }
          }
        }
        
        return references;
      } catch (error) {
        console.error('读取参考文献目录出错:', error);
        return [];
      }
    });

    ipcMain.handle('open-reference', async (event, reference) => {
      try {
        if (reference.local_file) {
          const absolutePath = path.isAbsolute(reference.local_file) 
            ? reference.local_file 
            : path.resolve(__dirname, reference.local_file);
          
          try {
            await fs.access(absolutePath);
            await shell.openPath(absolutePath);
            return { success: true, type: 'local' };
          } catch (fileError) {
            if (reference.url) {
              await shell.openExternal(reference.url);
              return { success: true, type: 'url_fallback' };
            }
            return { success: false, error: '本地文件不存在且无可用URL' };
          }
        } else if (reference.url) {
          await shell.openExternal(reference.url);
          return { success: true, type: 'url' };
        } else {
          return { success: false, error: '无可用文件或链接' };
        }
      } catch (error) {
        console.error('打开参考文献出错:', error);
        return { success: false, error: error.message };
      }
    });

    // 报告导出
    ipcMain.handle('export-report', async (event, reportData) => {
      try {
        const { reportContent, references = [], title = '研究报告' } = reportData;
        const config = await this.loadConfig();
        const exportDir = config.exportDirectory || path.join(__dirname, 'exports');
        
        // 确保导出目录存在
        await fs.mkdir(exportDir, { recursive: true });
        
        // 创建时间戳文件夹
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const folderName = `${title}_${timestamp}`;
        const exportPath = path.join(exportDir, folderName);
        
        await fs.mkdir(exportPath, { recursive: true });
        
        // 保存报告文件
        const reportFilePath = path.join(exportPath, 'report.md');
        await fs.writeFile(reportFilePath, reportContent, 'utf8');
        
        // 保存参考文献
        if (references.length > 0) {
          const referencesFilePath = path.join(exportPath, 'references.json');
          await fs.writeFile(referencesFilePath, JSON.stringify(references, null, 2), 'utf8');
        }
        
        // 打开导出目录
        shell.openPath(exportPath);
        
        return { 
          success: true, 
          exportPath,
          reportFile: reportFilePath
        };
      } catch (error) {
        console.error('导出报告出错:', error);
        return { success: false, error: error.message };
      }
    });
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // 如果配置文件不存在，使用默认配置
      this.config = { ...this.defaultConfig };
      await this.saveConfig(this.config);
    }
    return this.config;
  }

  async saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 创建应用实例
const researchApp = new ResearchAssistantApp();

// 应用事件
app.whenReady().then(() => {
  researchApp.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    researchApp.initialize();
  }
});