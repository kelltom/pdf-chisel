import { ElectronAPI } from '@electron-toolkit/preload'

export interface PdfFileInfo {
  filePath: string
  fileName: string
  pageCount: number
  error?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openPdf: () => Promise<PdfFileInfo | null>
      getPathForFile: (file: File) => string
      getFileInfo: (filePath: string) => Promise<PdfFileInfo | null>
    }
  }
}
