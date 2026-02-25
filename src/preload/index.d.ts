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

      mergePdfs: (args: { operation: 'merge'; filePaths: string[] }) => Promise<OperationResult>

      openPdfsDialog: () => Promise<string[]>

      openOutputFolder: (folderPath: string) => Promise<void>

      // Returns cleanup function — call in Svelte onDestroy to prevent listener accumulation
      onProgress: (callback: (data: { type: string; step: string }) => void) => () => void

      // Phase 3: Convert to Images
      readFileBytes: (filePath: string) => Promise<Uint8Array>
      makeConvertOutputFolder: () => Promise<string>
      writeImageFile: (args: {
        dataUrl: string
        outputFolder: string
        fileName: string
      }) => Promise<string>
      copyImageToClipboard: (filePath: string) => Promise<void>

      // Settings
      getSettings: () => Promise<{ outputPath: string; autoOpen: boolean }>
      setSettings: (patch: Partial<{ outputPath: string; autoOpen: boolean }>) => Promise<void>
      browseFolder: () => Promise<string | null>
      getAppVersion: () => Promise<string>

      // Per-mode state persistence
      getSplitState: () => Promise<{ mode: 'parts' | 'maxPages'; value: number }>
      setSplitState: (val: { mode: 'parts' | 'maxPages'; value: number }) => Promise<void>
      getConvertState: () => Promise<{ format: 'png' | 'jpeg'; dpi: number }>
      setConvertState: (val: { format: 'png' | 'jpeg'; dpi: number }) => Promise<void>
    }
  }
}
