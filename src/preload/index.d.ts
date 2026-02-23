import { ElectronAPI } from '@electron-toolkit/preload'

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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Phase 1: File operations
      openPdf: () => Promise<PdfFileInfo | null>
      getPathForFile: (file: File) => string
      getFileInfo: (filePath: string) => Promise<PdfFileInfo | null>

      // Phase 2: PDF operations
      extractPages: (args: {
        operation: 'extract'
        filePath: string
        params: { pageIndices: number[] }
      }) => Promise<OperationResult>

      splitPdf: (args: {
        operation: 'split'
        filePath: string
        params: { splitMode: 'parts' | 'maxPages'; splitValue: number }
      }) => Promise<OperationResult>

      mergePdfs: (args: {
        operation: 'merge'
        filePaths: string[]
      }) => Promise<OperationResult>

      openPdfsDialog: () => Promise<string[]>

      openOutputFolder: (folderPath: string) => Promise<void>

      // Returns cleanup function — call in Svelte onDestroy to prevent listener accumulation
      onProgress: (callback: (data: { type: string; step: string }) => void) => () => void
    }
  }
}
