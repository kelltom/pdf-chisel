import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface PdfFileInfo {
  filePath: string
  fileName: string
  pageCount: number
  error?: string
}

export interface OperationResult {
  outputFiles?: string[]
  outputFolder?: string
  error?: { cause: string; fix: string }
}

const api = {
  // FILE-01: Open native file dialog filtered to PDF files
  openPdf: (): Promise<PdfFileInfo | null> => ipcRenderer.invoke('dialog:open-pdf'),

  // FILE-02: Resolve a dragged File object to an absolute path.
  // MUST be called in preload — webUtils.getPathForFile is not available in the renderer.
  // File.path was removed in Electron 32; this is the only correct approach on Electron 34.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  // FILE-01/02/03: Get PDF metadata for a known file path.
  // Used by drag-drop flow (path from getPathForFile) and could be used to refresh metadata.
  getFileInfo: (filePath: string): Promise<PdfFileInfo | null> =>
    ipcRenderer.invoke('file:get-info', filePath),

  // Phase 2: PDF operations

  // EXTR-02: Extract selected pages to a new PDF
  extractPages: (args: {
    operation: 'extract'
    filePrefix?: string
    filePath: string
    params: { pageIndices: number[] }
  }): Promise<OperationResult> => ipcRenderer.invoke('pdf:extract', args),

  // SPLT-03: Split PDF into parts or by max pages per chunk
  splitPdf: (args: {
    operation: 'split'
    filePrefix?: string
    filePath: string
    params: { splitMode: 'parts' | 'maxPages'; splitValue: number }
  }): Promise<OperationResult> => ipcRenderer.invoke('pdf:split', args),

  // MERG-03: Merge multiple PDFs into one
  mergePdfs: (args: {
    operation: 'merge'
    filePaths: string[]
    filePrefix?: string
  }): Promise<OperationResult> => ipcRenderer.invoke('pdf:merge', args),

  // MERG-03: Open multi-file PDF picker dialog
  openPdfsDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:open-pdfs-multi'),

  // OUTP-03: Open output folder in Windows Explorer
  openOutputFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-folder', folderPath),

  // UX-01/02: Subscribe to progress events from Worker Thread.
  // Returns cleanup function — MUST be called in Svelte onDestroy to prevent listener accumulation.
  onProgress: (callback: (data: { type: string; step: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { type: string; step: string }) =>
      callback(data)
    ipcRenderer.on('pdf:progress', handler)
    return () => ipcRenderer.removeListener('pdf:progress', handler)
  },

  // CONV-03: Read raw PDF file bytes (for pdfjs-dist getDocument in renderer)
  readFileBytes: (filePath: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('file:read-bytes', filePath),

  // CONV-03: Create timestamped convert output folder; returns absolute folder path
  makeConvertOutputFolder: (): Promise<string> => ipcRenderer.invoke('pdf:make-convert-folder'),

  // CONV-03: Write rendered image data URL to disk; returns absolute file path
  writeImageFile: (args: {
    dataUrl: string
    outputFolder: string
    fileName: string
  }): Promise<string> => ipcRenderer.invoke('pdf:write-image', args),

  // REVW-03: Copy image at filePath to system clipboard
  copyImageToClipboard: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:write-image', filePath),

  // SETT-01: Read all persisted settings
  getSettings: (): Promise<{ outputPath: string; autoOpen: boolean }> =>
    ipcRenderer.invoke('settings:get'),

  // SETT-01: Write a partial settings update (live-save pattern)
  setSettings: (patch: Partial<{ outputPath: string; autoOpen: boolean }>): Promise<void> =>
    ipcRenderer.invoke('settings:set', patch),

  // SETT-01: Native folder picker dialog; returns path string or null if cancelled
  browseFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:browse-folder'),

  // SETT-03: Returns version string from package.json (e.g. "1.0.0")
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  // Per-mode Split persistence
  getSplitState: (): Promise<{ mode: 'parts' | 'maxPages'; value: number }> =>
    ipcRenderer.invoke('feature-state:get-split'),
  setSplitState: (val: { mode: 'parts' | 'maxPages'; value: number }): Promise<void> =>
    ipcRenderer.invoke('feature-state:set-split', val),

  // Per-mode Convert persistence
  getConvertState: (): Promise<{ format: 'png' | 'jpeg'; dpi: number }> =>
    ipcRenderer.invoke('feature-state:get-convert'),
  setConvertState: (val: { format: 'png' | 'jpeg'; dpi: number }): Promise<void> =>
    ipcRenderer.invoke('feature-state:set-convert', val)
}

// Honor contextIsolation setting: expose via contextBridge if isolated, fall back otherwise.
// The electron-vite scaffold sets contextIsolation: true, so the if-branch always runs.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback for non-isolated contexts — should not occur in this app)
  window.electron = electronAPI
  // @ts-ignore (fallback for non-isolated contexts — should not occur in this app)
  window.api = api
}
