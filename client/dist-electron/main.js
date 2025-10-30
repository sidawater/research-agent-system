import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { marked } from 'marked';
const DEFAULT_CONFIG = {
    websocketUrl: 'ws://127.0.0.1:18000/chat',
    apiServerUrl: 'http://127.0.0.1:18000/api/v1',
    exportDirectory: './data/',
    semanticApiKey: '',
};
function getConfigPath() {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'config.json');
}
function loadConfig() {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    }
    catch (err) {
        console.error('Failed to load config:', err);
    }
    return DEFAULT_CONFIG;
}
function saveConfig(config) {
    try {
        const configPath = getConfigPath();
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Failed to save config:', err);
        throw err;
    }
}
const __dirname = fileURLToPath(new URL('.', import.meta.url));
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: join(__dirname, 'preload.cjs'),
            // Keep isolation enabled for security; preload exposes APIs
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Do not open DevTools by default on startup
    // To open DevTools manually, set ELECTRON_OPEN_DEVTOOLS=1 before launching
    const openDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === '1';
    if (openDevTools) {
        try {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
        catch { }
    }
    // Capture renderer logs and errors
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        console.log(`[Renderer Console - Level ${level}]:`, message);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('Render process gone:', details);
    });
    mainWindow.webContents.on('unresponsive', () => {
        console.error('Renderer became unresponsive');
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) {
        console.log('Loading development URL:', devUrl);
        // Try the configured URL first, then fallback to common dev ports
        const tryUrls = [devUrl, 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'];
        const tryLoadUrl = async (urls, index = 0) => {
            if (index >= urls.length) {
                console.error('Failed to connect to dev server on all ports');
                return;
            }
            try {
                await mainWindow.loadURL(urls[index]);
                console.log('Successfully connected to:', urls[index]);
            }
            catch (err) {
                console.log(`Failed to load ${urls[index]}, trying next...`);
                await tryLoadUrl(urls, index + 1);
            }
        };
        tryLoadUrl(tryUrls);
    }
    else {
        // In production, load from the correct path
        let htmlPath;
        const tried = [];
        if (app.isPackaged) {
            // Prefer resources/dist
            let candidate = join(process.resourcesPath, 'dist', 'index.html');
            htmlPath = candidate;
            console.log('Packaged mode - initial path:', candidate);
            console.log('Resources path:', process.resourcesPath);
            console.log('Executable path:', process.execPath);
            console.log('app.getAppPath():', app.getAppPath());
            console.log('__dirname:', __dirname);
            // Fallbacks: win-unpacked/dist, app.asar/dist, sibling dist, root-level index.html in temp extraction
            const alternatives = [
                join(process.resourcesPath, '..', 'dist', 'index.html'), // win-unpacked/dist
                join(process.resourcesPath, 'app.asar', 'dist', 'index.html'), // packed in asar
                join(app.getAppPath(), 'dist', 'index.html'),
                join(__dirname, '../../dist/index.html'),
                join(process.resourcesPath, '..', 'index.html'), // portable sometimes extracts index.html at root
                join(app.getAppPath(), 'index.html'),
            ];
            if (!fs.existsSync(htmlPath)) {
                console.log('Primary path missing, checking alternatives...');
                for (const alt of alternatives) {
                    tried.push(alt);
                    console.log('Trying:', alt, '- Exists:', fs.existsSync(alt));
                    if (fs.existsSync(alt)) {
                        htmlPath = alt;
                        break;
                    }
                }
            }
        }
        else {
            // In development or unpackaged mode
            htmlPath = join(__dirname, '../dist/index.html');
        }
        console.log('Final loading path:', htmlPath);
        console.log('File exists:', fs.existsSync(htmlPath));
        if (!fs.existsSync(htmlPath)) {
            console.error('Failed to resolve index.html. Tried paths:', tried);
        }
        mainWindow.loadFile(htmlPath).catch(err => {
            console.error('Failed to load HTML file:', err);
            dialog.showErrorBox('Failed to Load Application', `Could not load the application. Please reinstall.

Error: ${err.message}
Path: ${htmlPath}
Is Packaged: ${app.isPackaged}
Resources: ${process.resourcesPath}
App Path: ${app.getAppPath()}`);
        });
    }
    // Log when page finishes loading
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Page loaded successfully');
    });
    // Log any loading errors
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('Page failed to load:', errorCode, errorDescription);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
// Example IPC
ipcMain.handle('ping', async () => {
    return 'pong';
});
ipcMain.handle('load-config', async () => {
    return loadConfig();
});
ipcMain.handle('save-config', async (_evt, config) => {
    saveConfig(config);
    return { success: true };
});
ipcMain.handle('select-export-directory', async () => {
    const res = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths?.[0]) {
        return null;
    }
    return res.filePaths[0];
});
ipcMain.handle('export-report', async (_evt, payload) => {
    try {
        const dirRes = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
        if (dirRes.canceled || !dirRes.filePaths?.[0]) {
            return { success: false, error: 'canceled' };
        }
        const baseDir = dirRes.filePaths[0];
        const folderName = payload.title?.replace(/[\\/:*?"<>|]/g, '_') || `research_report_${Date.now()}`;
        const exportDir = join(baseDir, folderName);
        await fs.promises.mkdir(exportDir, { recursive: true });
        const reportPath = join(exportDir, 'report.md');
        const refsPath = join(exportDir, 'references.json');
        await fs.promises.writeFile(reportPath, payload.reportContent || '', 'utf-8');
        await fs.promises.writeFile(refsPath, JSON.stringify(payload.references ?? [], null, 2), 'utf-8');
        return { success: true, directory: exportDir, files: { reportPath, refsPath } };
    }
    catch (err) {
        return { success: false, error: err?.message || String(err) };
    }
});
ipcMain.handle('export-report-with-pdf', async (_evt, payload) => {
    try {
        const { sessionId, title, reportContent, exportDirectory } = payload;
        if (!reportContent) {
            return { success: false, error: 'No report content provided' };
        }
        if (!exportDirectory) {
            return { success: false, error: 'Export directory not configured' };
        }
        // Create directory: {exportDirectory}/{sessionId first 8 chars}-{today's date}
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const sessionPrefix = sessionId.substring(0, 8);
        const folderName = `${sessionPrefix}-${dateStr}`;
        const targetDir = join(exportDirectory, folderName);
        await fs.promises.mkdir(targetDir, { recursive: true });
        // Sanitize title for filename
        const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_');
        const mdPath = join(targetDir, `${sanitizedTitle}.md`);
        const pdfPath = join(targetDir, `${sanitizedTitle}.pdf`);
        // Save Markdown file
        await fs.promises.writeFile(mdPath, reportContent, 'utf-8');
        console.log(`Markdown saved: ${mdPath}`);
        // Parse Markdown to HTML using marked (server-side, no CDN dependency)
        const parsedHtml = await marked.parse(reportContent);
        // Generate PDF using a hidden BrowserWindow
        const pdfWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        try {
            // Create HTML with enhanced styles for PDF generation
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 1.5cm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 
                   'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      padding: 20px;
      max-width: 100%;
      margin: 0 auto;
      color: #333;
      font-size: 14px;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      page-break-after: avoid;
    }
    h1 { 
      font-size: 2em; 
      border-bottom: 2px solid #eaecef; 
      padding-bottom: 0.3em;
      page-break-before: auto;
    }
    h2 { 
      font-size: 1.5em; 
      border-bottom: 1px solid #eaecef; 
      padding-bottom: 0.3em;
    }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    h5 { font-size: 1em; }
    h6 { font-size: 0.9em; color: #6a737d; }
    
    p {
      margin: 0 0 16px 0;
    }
    
    code {
      background-color: #f6f8fa;
      border-radius: 3px;
      font-size: 85%;
      margin: 0;
      padding: 0.2em 0.4em;
      font-family: 'Consolas', 'Monaco', 'Courier New', Courier, monospace;
    }
    
    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      font-size: 85%;
      line-height: 1.45;
      overflow: auto;
      padding: 16px;
      margin: 0 0 16px 0;
      page-break-inside: avoid;
    }
    
    pre code {
      background-color: transparent;
      border: 0;
      display: inline;
      line-height: inherit;
      margin: 0;
      overflow: visible;
      padding: 0;
      word-wrap: normal;
      font-size: 100%;
    }
    
    blockquote {
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      padding: 0 1em;
      margin: 0 0 16px 0;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    
    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
      text-align: left;
    }
    
    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    
    table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    ul, ol {
      padding-left: 2em;
      margin: 0 0 16px 0;
    }
    
    li {
      margin-top: 0.25em;
    }
    
    li > p {
      margin: 0;
    }
    
    a {
      color: #0366d6;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px 0;
    }
    
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
    
    /* Print optimizations */
    @media print {
      body {
        padding: 0;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      pre, table, blockquote {
        page-break-inside: avoid;
      }
      img {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${parsedHtml}
</body>
</html>
`;
            // Load HTML content
            await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            // Wait for content to fully render
            await new Promise((resolve) => {
                pdfWindow.webContents.once('did-finish-load', () => {
                    // Additional delay to ensure all styles are applied
                    setTimeout(() => resolve(), 500);
                });
            });
            // Generate PDF with optimized settings
            const pdfData = await pdfWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                margins: {
                    top: 0.5,
                    bottom: 0.5,
                    left: 0.5,
                    right: 0.5,
                },
            });
            // Save PDF file
            await fs.promises.writeFile(pdfPath, pdfData);
            console.log(`PDF saved: ${pdfPath}`);
            return {
                success: true,
                directory: targetDir,
                files: {
                    mdPath,
                    pdfPath,
                },
            };
        }
        finally {
            pdfWindow.close();
        }
    }
    catch (err) {
        console.error('Export error:', err);
        return { success: false, error: err?.message || String(err) };
    }
});
ipcMain.handle('references:download', async (_evt, payload) => {
    try {
        const { url, title, sessionId, exportDirectory, index, doi } = payload || {};
        if (!url || !/^https?:/i.test(url)) {
            return { success: false, isPdf: false, errorMessage: 'Invalid URL provided' };
        }
        if (!exportDirectory) {
            return { success: false, isPdf: false, errorMessage: 'Export directory not configured' };
        }
        if (!sessionId) {
            return { success: false, isPdf: false, errorMessage: 'No sessionId provided' };
        }
        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const sessionPrefix = String(sessionId).substring(0, 8);
        const baseDir = join(exportDirectory, `${sessionPrefix}_${yyyymmdd}`);
        await fs.promises.mkdir(baseDir, { recursive: true });
        const safeTitle = String(title || 'reference').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
        const twoDigitIndex = String(Math.max(1, index + 1)).padStart(2, '0');
        const doiSanitized = String(doi || 'no-doi').replace(/\//g, '+').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
        const filePath = join(baseDir, `${twoDigitIndex}-${doiSanitized}-${safeTitle}.pdf`);
        const follow = (u, redirectCount = 0) => {
            return new Promise((resolve) => {
                const client = u.startsWith('https') ? https : http;
                const req = client.get(u, (res) => {
                    const statusCode = res.statusCode || 0;
                    const contentType = String(res.headers['content-type'] || '');
                    if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                        if (redirectCount > 5) {
                            res.resume();
                            return resolve({
                                isPdf: false,
                                error: 'Too many redirects (>5)',
                                statusCode,
                                redirects: redirectCount
                            });
                        }
                        const next = res.headers.location.startsWith('http')
                            ? res.headers.location
                            : new URL(res.headers.location, u).toString();
                        res.resume();
                        return resolve(follow(next, redirectCount + 1));
                    }
                    if (statusCode !== 200) {
                        res.resume();
                        return resolve({
                            isPdf: false,
                            error: `HTTP ${statusCode} ${res.statusMessage || ''}`,
                            statusCode,
                            contentType,
                            finalUrl: u
                        });
                    }
                    const ws = fs.createWriteStream(filePath);
                    let firstChunk = null;
                    res.on('data', (chunk) => {
                        if (!firstChunk)
                            firstChunk = Buffer.from(chunk);
                    });
                    res.pipe(ws);
                    ws.on('finish', async () => {
                        ws.close();
                        const prefixIsPdf = firstChunk?.slice(0, 5).toString('utf8') === '%PDF-';
                        const typeIsPdf = /pdf/i.test(contentType);
                        if (prefixIsPdf || typeIsPdf) {
                            return resolve({
                                isPdf: true,
                                savedPath: filePath,
                                statusCode,
                                contentType,
                                finalUrl: u,
                                redirects: redirectCount
                            });
                        }
                        return resolve({
                            isPdf: false,
                            error: `Not a PDF (Content-Type: ${contentType}, Header check: failed)`,
                            statusCode,
                            contentType,
                            finalUrl: u
                        });
                    });
                    ws.on('error', (err) => {
                        res.resume();
                        return resolve({
                            isPdf: false,
                            error: `File write error: ${String(err)}`,
                            statusCode,
                            contentType
                        });
                    });
                });
                req.on('error', (err) => {
                    return resolve({
                        isPdf: false,
                        error: `Network error: ${String(err)}`
                    });
                });
            });
        };
        const result = await follow(url);
        if (result.isPdf && result.savedPath) {
            return {
                success: true,
                isPdf: true,
                filepath: result.savedPath,
                statusCode: result.statusCode,
                contentType: result.contentType,
                finalUrl: result.finalUrl,
                redirects: result.redirects
            };
        }
        return {
            success: false,
            isPdf: false,
            errorMessage: result.error || 'Unknown error',
            statusCode: result.statusCode,
            contentType: result.contentType,
            finalUrl: result.finalUrl
        };
    }
    catch (err) {
        console.error('Download error:', err);
        return {
            success: false,
            isPdf: false,
            errorMessage: `Exception: ${err?.message || String(err)}`
        };
    }
});
//# sourceMappingURL=main.js.map