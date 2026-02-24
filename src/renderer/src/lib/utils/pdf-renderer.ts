import * as pdfjsLib from 'pdfjs-dist'

// Worker config: new URL pattern — more reliable than ?url import in electron-vite production builds.
// Reference: pdfjs Discussion #19520 — confirmed working for pdfjs v4+ with Vite.
// If production build fails with "Setting up fake worker" warning, fall back to copying
// the worker to src/renderer/public/pdf.worker.min.mjs and setting workerSrc = '/pdf.worker.min.mjs'.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// DPI → scale conversion: PDF uses 72 DPI internally; getViewport({scale:1}) = 72 DPI.
// To get targetDPI output: scale = targetDPI / 72.
// e.g. 96 DPI → 1.333; 150 DPI → 2.083; 300 DPI → 4.167

/**
 * Render a single PDF page to a data URL.
 * Must run in the renderer process — browser canvas API required.
 * Do NOT call from a Node.js Worker Thread (no document.createElement there).
 *
 * @param pdfBytes  Raw bytes of the PDF file
 * @param pageNumber  1-indexed page number
 * @param dpi  Target DPI (72 | 96 | 150 | 300)
 * @param format  Output image format
 * @returns Data URL string (e.g. 'data:image/png;base64,...')
 */
export async function renderPageToDataUrl(
  pdfBytes: Uint8Array,
  pageNumber: number,
  dpi: number,
  format: 'png' | 'jpeg'
): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const pdf = await loadingTask.promise

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
