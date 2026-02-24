import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Worker config: new URL pattern — more reliable than ?url import in electron-vite production builds.
// pdfjs-dist v4 is used deliberately (v5 calls Uint8Array.prototype.toHex() which is absent in
// Electron's Chromium worker context, causing "a.toHex is not a function" on every PDF).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// DPI → scale conversion: PDF uses 72 DPI internally; getViewport({scale:1}) = 72 DPI.
// To get targetDPI output: scale = targetDPI / 72.
// e.g. 96 DPI → 1.333; 150 DPI → 2.083; 300 DPI → 4.167

/**
 * Load a PDF document from raw bytes.
 * Call once per file, then pass the returned document to renderPageFromDoc for each page.
 * The caller must call pdf.destroy() when done to free worker memory.
 */
export async function loadPdfDocument(pdfBytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdfjs transfers the ArrayBuffer to the worker on getDocument(), detaching the original.
  // slice() copies the bytes so the caller's buffer is unaffected and safe to discard.
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() })
  return loadingTask.promise
}

/**
 * Render a single page from an already-loaded PDF document to a data URL.
 * Must run in the renderer process — browser canvas API required.
 *
 * @param pdf       Document returned by loadPdfDocument()
 * @param pageNumber  1-indexed page number
 * @param dpi  Target DPI (72 | 96 | 150 | 300)
 * @param format  Output image format
 * @returns Data URL string (e.g. 'data:image/png;base64,...')
 */
export async function renderPageFromDoc(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  format: 'png' | 'jpeg'
): Promise<string> {
  const page = await pdf.getPage(pageNumber)

  const scale = dpi / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  await page.render({ canvasContext: ctx, viewport }).promise

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined
  const dataUrl = canvas.toDataURL(mimeType, quality)

  // Clean up to avoid canvas memory leaks on large PDFs
  canvas.width = 0
  canvas.height = 0
  page.cleanup()

  return dataUrl
}
