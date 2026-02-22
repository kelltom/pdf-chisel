import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e2e',
      symbolColor: '#cdd6f4',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,          // Required for @electron-toolkit/preload
      contextIsolation: true,  // Default since Electron 12; explicit for security audit
      nodeIntegration: false   // Default since Electron 5; explicit for security audit
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pdfchisel')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // FILE-01: Native PDF file picker
  ipcMain.handle('dialog:open-pdf', async (_event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select PDF File',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    try {
      const bytes = await readFile(filePaths[0])
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
      const fileName = filePaths[0].split(/[\\/]/).pop() ?? filePaths[0]
      return {
        filePath: filePaths[0],
        fileName,
        pageCount: doc.getPageCount()
      }
    } catch (err) {
      return { filePath: filePaths[0], fileName: filePaths[0].split(/[\\/]/).pop() ?? filePaths[0], pageCount: 0, error: String(err) }
    }
  })

  // FILE-02 + FILE-03: Get PDF info for a known path (used by drag-drop flow)
  ipcMain.handle('file:get-info', async (_event, filePath: string) => {
    try {
      const bytes = await readFile(filePath)
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath
      return {
        filePath,
        fileName,
        pageCount: doc.getPageCount()
      }
    } catch (err) {
      return { filePath, fileName: filePath.split(/[\\/]/).pop() ?? filePath, pageCount: 0, error: String(err) }
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
