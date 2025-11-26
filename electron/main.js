const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

// === 定义 isDev 变量 ===
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 允许渲染进程直接使用 node 模块
      webSecurity: false       // 允许加载本地资源
    },
    titleBarStyle: 'hiddenInset', // Mac 风格标题栏
    autoHideMenuBar: true,        // Windows 隐藏菜单栏，更像原生App
    title: "DeepSeek RAG Pro"
  });

  if (isDev) {
    // 开发模式：加载 React 开发服务器
    mainWindow.loadURL('http://localhost:3000');
    // 开发模式打开调试工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 HTML 文件
    // 注意：React build 后的文件会在 ../build/index.html
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startPythonBackend() {
  const scriptPath = path.join(__dirname, '../backend/server.py');
  
  console.log("Starting Python backend from:", scriptPath);
  
  // 启动 Python 后端
  pythonProcess = spawn('python', [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });
}

app.on('ready', () => {
  // === 关键修复 ===
  // 如果是开发模式 (!isDev 为 false)，不要在 Electron 里启动 Python
  // 因为 npm run dev 已经通过 concurrently 启动了一个 Python 进程
  if (!isDev) {
    startPythonBackend();
  }
  
  createWindow();
});

app.on('window-all-closed', function () {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
    if (pythonProcess) pythonProcess.kill();
});