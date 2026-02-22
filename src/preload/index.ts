import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface PdfFileInfo {
  filePath: string
  fileName: string
  pageCount: number
  error?: string
}

const api = {
  // FILE-01: Open native file dialog filtered to PDF files
  openPdf: (): Promise<PdfFileInfo | null> =>
    ipcRenderer.invoke('dialog:open-pdf'),

  // FILE-02: Resolve a dragged File object to an absolute path.
  // MUST be called in preload — webUtils.getPathForFile is not available in the renderer.
  // File.path was removed in Electron 32; this is the only correct approach on Electron 34.
  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  // FILE-01/02/03: Get PDF metadata for a known file path.
  // Used by drag-drop flow (path from getPathForFile) and could be used to refresh metadata.
  getFileInfo: (filePath: string): Promise<PdfFileInfo | null> =>
    ipcRenderer.invoke('file:get-info', filePath),
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
  // @ts-ignore
  window.api = api
}
