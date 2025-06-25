const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let initialFilePath = null;

// Look for file path argument (non-flag arguments)
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--') && !args[i].startsWith('-')) {
    initialFilePath = path.resolve(args[i]);
    break;
  }
}

// Default to current working directory if no argument provided
if (!initialFilePath) {
  initialFilePath = process.cwd();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.maximize();

  mainWindow.loadFile('index.html');

  // Send initial file/directory path to renderer if provided
  mainWindow.webContents.once('did-finish-load', () => {
    if (initialFilePath && fs.existsSync(initialFilePath)) {
      const stats = fs.statSync(initialFilePath);
      if (stats.isDirectory()) {
        mainWindow.webContents.send('open-initial-directory', initialFilePath);
      } else {
        mainWindow.webContents.send('open-initial-file', initialFilePath);
      }
    }
  });
  
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('open-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'CmdOrCtrl+Tab',
          click: () => {
            mainWindow.webContents.send('next-tab');
          }
        },
        {
          label: 'Previous Tab',
          accelerator: 'CmdOrCtrl+Shift+Tab',
          click: () => {
            mainWindow.webContents.send('prev-tab');
          }
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow.webContents.send('close-tab');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
      { name: 'Python', extensions: ['py'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'CSS', extensions: ['css', 'scss', 'sass'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt', 'md'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    try {
      const stats = fs.statSync(selectedPath);
      
      if (stats.isDirectory()) {
        // Handle directory
        const files = fs.readdirSync(selectedPath).map(fileName => {
          const fullPath = path.join(selectedPath, fileName);
          const fileStats = fs.statSync(fullPath);
          return {
            name: fileName,
            path: fullPath,
            isDirectory: fileStats.isDirectory(),
            size: fileStats.size,
            modified: fileStats.mtime
          };
        });
        
        return {
          success: true,
          isDirectory: true,
          directoryPath: selectedPath,
          directoryName: path.basename(selectedPath),
          files: files
        };
      } else {
        // Handle file
        const content = fs.readFileSync(selectedPath, 'utf-8');
        const ext = path.extname(selectedPath).toLowerCase().substring(1);
        return {
          success: true,
          isDirectory: false,
          filePath: selectedPath,
          content,
          extension: ext,
          fileName: path.basename(selectedPath)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  return { success: false, canceled: true };
});

ipcMain.handle('open-file-from-path', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase().substring(1);
    return {
      success: true,
      filePath,
      content,
      extension: ext,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});