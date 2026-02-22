export type Mode = 'extract' | 'split' | 'convert' | 'merge' | 'settings'

export interface FileInfo {
  filePath: string
  fileName: string
  pageCount: number
  error?: string
}

export const appState = $state({
  currentMode: 'extract' as Mode,
  currentFile: null as FileInfo | null,
})
