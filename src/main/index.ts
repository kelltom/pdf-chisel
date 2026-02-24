import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'
import createPdfWorker from './workers/pdf-worker?nodeWorker'

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

function makeOutputFolder(baseDir: string, mode: string): string {
  const now = new Date()
  const ts =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  return join(baseDir, `${ts}-${mode}`)
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

  // EXTR-02: Extract pages operation — spawns Worker Thread
  ipcMain.handle('pdf:extract', async (event, args) => {
    const baseDir = join(app.getPath('documents'), 'PDF Chisel')
    const outputFolder = makeOutputFolder(baseDir, 'extract')
    return new Promise((resolve) => {
      const worker = createPdfWorker({ workerData: { ...args, outputFolder } })
      worker.on('message', (msg) => {
        if (msg.type === 'progress') event.sender.send('pdf:progress', msg)
        else if (msg.type === 'complete') resolve(msg.result)
        else if (msg.type === 'error') resolve({ error: msg.error })
      })
      worker.on('error', (err) => resolve({ error: { cause: err.message, fix: 'Try a different PDF file.' } }))
      worker.on('exit', (code) => { if (code !== 0) resolve({ error: { cause: `Worker exited with code ${code}`, fix: 'Restart the app.' } }) })
    })
  })

  // SPLT-03: Split PDF operation — spawns Worker Thread
  ipcMain.handle('pdf:split', async (event, args) => {
    const baseDir = join(app.getPath('documents'), 'PDF Chisel')
    const outputFolder = makeOutputFolder(baseDir, 'split')
    return new Promise((resolve) => {
      const worker = createPdfWorker({ workerData: { ...args, outputFolder } })
      worker.on('message', (msg) => {
        if (msg.type === 'progress') event.sender.send('pdf:progress', msg)
        else if (msg.type === 'complete') resolve(msg.result)
        else if (msg.type === 'error') resolve({ error: msg.error })
      })
      worker.on('error', (err) => resolve({ error: { cause: err.message, fix: 'Try a different PDF file.' } }))
      worker.on('exit', (code) => { if (code !== 0) resolve({ error: { cause: `Worker exited with code ${code}`, fix: 'Restart the app.' } }) })
    })
  })

  // MERG-03: Merge PDFs operation — spawns Worker Thread
  ipcMain.handle('pdf:merge', async (event, args) => {
    const baseDir = join(app.getPath('documents'), 'PDF Chisel')
    const outputFolder = makeOutputFolder(baseDir, 'merge')
    return new Promise((resolve) => {
      const worker = createPdfWorker({ workerData: { ...args, outputFolder } })
      worker.on('message', (msg) => {
        if (msg.type === 'progress') event.sender.send('pdf:progress', msg)
        else if (msg.type === 'complete') resolve(msg.result)
        else if (msg.type === 'error') resolve({ error: msg.error })
      })
      worker.on('error', (err) => resolve({ error: { cause: err.message, fix: 'Try a different PDF file.' } }))
      worker.on('exit', (code) => { if (code !== 0) resolve({ error: { cause: `Worker exited with code ${code}`, fix: 'Restart the app.' } }) })
    })
  })

  // MERG-03: Multi-file PDF picker for Merge mode
  ipcMain.handle('dialog:open-pdfs-multi', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select PDF Files to Merge',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (canceled || filePaths.length === 0) return []
    return filePaths
  })

  // OUTP-03: Open output folder in Windows Explorer
  ipcMain.handle('shell:open-folder', async (_event, folderPath: string) => {
    const err = await shell.openPath(folderPath)
    if (err) console.error('shell.openPath error:', err)
  })

  // CONV-03: Read raw PDF bytes and return to renderer for pdfjs rendering.
  // The renderer process cannot access the filesystem directly (nodeIntegration: false).
  // Returns a Buffer (serialized as Uint8Array over IPC).
  ipcMain.handle('file:read-bytes', async (_event, filePath: string) => {
    const { readFile: readFileBytes } = await import('fs/promises')
    return readFileBytes(filePath)
  })

  // CONV-03: Write a rendered image data URL to disk as an image file.
  // Called once per page during conversion — sequential, not parallel (IPC message size management).
  // dataUrl: 'data:image/png;base64,...' or 'data:image/jpeg;base64,...'
  // outputFolder: absolute path to the timestamped output folder (created by main if needed)
  // fileName: e.g. 'page-01.png'
  // Returns the absolute output file path on success.
  ipcMain.handle('pdf:write-image', async (_event, args: { dataUrl: string; outputFolder: string; fileName: string }) => {
    const { mkdir: mkdirImg, writeFile: writeFileImg } = await import('fs/promises')
    const { join: joinImg } = await import('path')
    await mkdirImg(args.outputFolder, { recursive: true })
    const base64 = args.dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const filePath = joinImg(args.outputFolder, args.fileName)
    await writeFileImg(filePath, buffer)
    return filePath
  })

  // CONV-03: Create and return a timestamped output folder for image conversion.
  // Pattern matches other modes: {documents}/PDF Chisel/{timestamp}-convert/
  ipcMain.handle('pdf:make-convert-folder', async () => {
    const { mkdir: mkdirConv } = await import('fs/promises')
    const baseDir = join(app.getPath('documents'), 'PDF Chisel')
    const outputFolder = makeOutputFolder(baseDir, 'convert')
    await mkdirConv(outputFolder, { recursive: true })
    return outputFolder
  })

  // REVW-03: Read an image file from disk and write it to the system clipboard.
  // Takes a file path (not a data URL) — avoids IPC message size issues for 300 DPI images.
  // Uses nativeImage.createFromBuffer — works for both PNG and JPEG files.
  ipcMain.handle('clipboard:write-image', async (_event, filePath: string) => {
    const { clipboard, nativeImage } = await import('electron')
    const { readFile: readFileClip } = await import('fs/promises')
    const buffer = await readFileClip(filePath)
    const image = nativeImage.createFromBuffer(buffer)
    clipboard.writeImage(image)
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
