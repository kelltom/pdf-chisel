/**
 * Result returned by all PDF operation IPC handlers (extract, split, merge).
 * Renderer-only type — do not import from main or preload (process boundary).
 */
export interface OperationResult {
  outputFiles?: string[]
  outputFolder?: string
  error?: { cause: string; fix: string }
}
