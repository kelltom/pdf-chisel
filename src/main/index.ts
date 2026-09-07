import { app, shell, BrowserWindow, ipcMain, dialog, type IpcMainInvokeEvent } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'
import createPdfWorker from './workers/pdf-worker?nodeWorker'
import { Conf } from 'electron-conf/main'
import type { Worker } from 'node:worker_threads'

interface AppSettings {
  outputPath: string
  autoOpen: boolean
}

interface FeatureState {
  split: { mode: 'parts' | 'maxPages'; value: number }
  convert: { format: 'png' | 'jpeg'; dpi: number }
}

interface PdfOperationArgs {
  operation: 'extract' | 'split' | 'merge'
  filePrefix?: string
  filePath?: string
  filePaths?: string[]
  params: {
    pageIndices?: number[]
    splitMode?: 'parts' | 'maxPages'
    splitValue?: number
  }
}

interface PdfOperationResult {
  outputFiles?: string[]
  outputFolder?: string
  error?: { cause: string; fix: string }
}

interface PdfWorkerMessage {
  type: 'progress' | 'complete' | 'error'
  step?: string
  result?: PdfOperationResult
  error?: { cause: string; fix: string }
}

const settings = new Conf<AppSettings>({
  name: 'settings',
  defaults: {
    outputPath: '', // empty = use ~/Documents/PDF Chisel at runtime
    autoOpen: false
  }
})

const featureState = new Conf<FeatureState>({
  name: 'feature-state',
  defaults: {
    split: { mode: 'parts', value: 2 },
    convert: { format: 'png', dpi: 96 }
  }
})

const FORCE_EXIT_TIMEOUT_MS = 5_000
const activeWorkers = new Set<Worker>()
let isShuttingDown = false
let forceExitTimer: NodeJS.Timeout | null = null

function registerWorker(worker: Worker): void {
  activeWorkers.add(worker)
  const clear = () => activeWorkers.delete(worker)
  worker.once('error', clear)
  worker.once('exit', clear)
}

async function terminateActiveWorkers(): Promise<void> {
  const workers = Array.from(activeWorkers)
  activeWorkers.clear()

  await Promise.allSettled(
    workers.map(async (worker) => {
      try {
        await worker.terminate()
      } catch (err) {
        console.error('Failed to terminate worker thread:', err)
      }
    })
  )
}

function scheduleForcedExit(): void {
  if (forceExitTimer) return

  forceExitTimer = setTimeout(() => {
    console.warn(`Shutdown timeout reached (${FORCE_EXIT_TIMEOUT_MS}ms); forcing exit.`)
    app.exit(0)
  }, FORCE_EXIT_TIMEOUT_MS)

  forceExitTimer.unref()
}

function clearForcedExitTimer(): void {
  if (!forceExitTimer) return
  clearTimeout(forceExitTimer)
  forceExitTimer = null
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 730,
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
      sandbox: false, // Required for @electron-toolkit/preload
      contextIsolation: true, // Default since Electron 12; explicit for security audit
      nodeIntegration: false // Default since Electron 5; explicit for security audit
    }
  })

  const showWindow = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  }

  mainWindow.on('ready-to-show', showWindow)
  mainWindow.webContents.on('did-finish-load', showWindow)
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`Renderer failed to load (${code}) at ${url}: ${description}`)
    showWindow()
  })

  // Failsafe: never leave the app running headless due to a missed ready-to-show event.
  const showFallbackTimer = setTimeout(showWindow, 3_000)
  showFallbackTimer.unref()
  mainWindow.on('closed', () => clearTimeout(showFallbackTimer))

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

function getOutputBase(): string {
  const stored = settings.get('outputPath')
  return stored && stored.length > 0 ? stored : join(app.getPath('documents'), 'PDF Chisel')
}

function runPdfOperation(
  event: IpcMainInvokeEvent,
  args: PdfOperationArgs,
  operation: 'extract' | 'split' | 'merge'
): Promise<PdfOperationResult> {
  if (isShuttingDown) {
    return Promise.resolve({
      error: {
        cause: 'The app is closing.',
        fix: 'Wait for shutdown to finish, then reopen the app.'
      }
    })
  }

  const baseDir = getOutputBase()
  const outputFolder = makeOutputFolder(baseDir, operation)

  return new Promise((resolve) => {
    const worker = createPdfWorker({ workerData: { ...args, operation, outputFolder } }) as Worker
    registerWorker(worker)

    let settled = false
    const finish = (result: PdfOperationResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }

    worker.on('message', (msg: PdfWorkerMessage) => {
      if (msg.type === 'progress') {
        if (!event.sender.isDestroyed()) {
          event.sender.send('pdf:progress', msg)
        }
        return
      }

      if (msg.type === 'complete') {
        finish(msg.result ?? {})
        return
      }

      if (msg.type === 'error') {
        finish({
          error: msg.error ?? { cause: 'Unexpected worker error.', fix: 'Restart the app.' }
        })
      }
    })

    worker.on('error', (err) => {
      finish({ error: { cause: err.message, fix: 'Try a different PDF file.' } })
    })

    worker.on('exit', (code) => {
      if (settled || code === 0) return
      finish({ error: { cause: `Worker exited with code ${code}`, fix: 'Restart the app.' } })
    })
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  const existingWindow = BrowserWindow.getAllWindows()[0]
  if (!existingWindow) {
    if (!isShuttingDown && app.isReady()) {
      createWindow()
    }
    return
  }
  if (existingWindow.isMinimized()) existingWindow.restore()
  if (!existingWindow.isVisible()) existingWindow.show()
  existingWindow.focus()
})

app.on('before-quit', (event) => {
  if (isShuttingDown) return
  isShuttingDown = true

  if (activeWorkers.size === 0) return

  event.preventDefault()
  scheduleForcedExit()

  void terminateActiveWorkers().finally(() => {
    app.quit()
  })
})

app.on('will-quit', () => {
  clearForcedExitTimer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

if (hasSingleInstanceLock) {
  app
    .whenReady()
    .then(() => {
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
          return {
            filePath: filePaths[0],
            fileName: filePaths[0].split(/[\\/]/).pop() ?? filePaths[0],
            pageCount: 0,
            error: String(err)
          }
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
          return {
            filePath,
            fileName: filePath.split(/[\\/]/).pop() ?? filePath,
            pageCount: 0,
            error: String(err)
          }
        }
      })

      // EXTR-02: Extract pages operation - spawns Worker Thread
      ipcMain.handle('pdf:extract', async (event, args: PdfOperationArgs) => {
        return runPdfOperation(event, args, 'extract')
      })

      // SPLT-03: Split PDF operation - spawns Worker Thread
      ipcMain.handle('pdf:split', async (event, args: PdfOperationArgs) => {
        return runPdfOperation(event, args, 'split')
      })

      // MERG-03: Merge PDFs operation - spawns Worker Thread
      ipcMain.handle('pdf:merge', async (event, args: PdfOperationArgs) => {
        return runPdfOperation(event, args, 'merge')
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
      // Called once per page during conversion - sequential, not parallel (IPC message size management).
      // dataUrl: 'data:image/png;base64,...' or 'data:image/jpeg;base64,...'
      // outputFolder: absolute path to the timestamped output folder (created by main if needed)
      // fileName: e.g. 'page-01.png'
      // Returns the absolute output file path on success.
      ipcMain.handle(
        'pdf:write-image',
        async (_event, args: { dataUrl: string; outputFolder: string; fileName: string }) => {
          const { mkdir: mkdirImg, writeFile: writeFileImg } = await import('fs/promises')
          const { join: joinImg } = await import('path')
          await mkdirImg(args.outputFolder, { recursive: true })
          const base64 = args.dataUrl.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64, 'base64')
          const filePath = joinImg(args.outputFolder, args.fileName)
          await writeFileImg(filePath, buffer)
          return filePath
        }
      )

      // CONV-03: Create and return a timestamped output folder for image conversion.
      // Pattern matches other modes: {documents}/PDF Chisel/{timestamp}-convert/
      ipcMain.handle('pdf:make-convert-folder', async () => {
        const { mkdir: mkdirConv } = await import('fs/promises')
        const baseDir = getOutputBase()
        const outputFolder = makeOutputFolder(baseDir, 'convert')
        await mkdirConv(outputFolder, { recursive: true })
        return outputFolder
      })

      // REVW-03: Read an image file from disk and write it to the system clipboard.
      // Takes a file path (not a data URL) - avoids IPC message size issues for 300 DPI images.
      // Uses nativeImage.createFromBuffer - works for both PNG and JPEG files.
      ipcMain.handle('clipboard:write-image', async (_event, filePath: string) => {
        const { clipboard, nativeImage } = await import('electron')
        const { readFile: readFileClip } = await import('fs/promises')
        const buffer = await readFileClip(filePath)
        const image = nativeImage.createFromBuffer(buffer)
        clipboard.writeImage(image)
      })

      // SETT-01: Get all settings as one object
      ipcMain.handle('settings:get', () => settings.store)

      // SETT-01: Patch settings (partial update - only keys present in patch are written)
      ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>) => {
        settings.set(patch)
      })

      // SETT-01: Native folder picker for Browse button
      ipcMain.handle('settings:browse-folder', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'Select Output Folder',
          defaultPath: settings.get('outputPath') || app.getPath('documents'),
          properties: ['openDirectory']
        })
        if (canceled || filePaths.length === 0) return null
        return filePaths[0]
      })

      // SETT-03: App version from package.json (works in dev and production)
      ipcMain.handle('app:get-version', () => app.getVersion())

      // Per-mode feature state (Split)
      ipcMain.handle('feature-state:get-split', () => featureState.get('split'))
      ipcMain.handle(
        'feature-state:set-split',
        (_event, val: { mode: 'parts' | 'maxPages'; value: number }) => {
          featureState.set('split', val)
        }
      )

      // Per-mode feature state (Convert)
      ipcMain.handle('feature-state:get-convert', () => featureState.get('convert'))
      ipcMain.handle(
        'feature-state:set-convert',
        (_event, val: { format: 'png' | 'jpeg'; dpi: number }) => {
          featureState.set('convert', val)
        }
      )

      app.on('activate', () => {
        if (!isShuttingDown && BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
    .catch((err) => {
      console.error('App startup failed:', err)
      app.exit(1)
    })
}
