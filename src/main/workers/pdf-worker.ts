import { workerData, parentPort } from 'worker_threads'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { PDFDocument, EncryptedPDFError } from 'pdf-lib'

interface WorkerArgs {
  operation: 'extract' | 'split' | 'merge'
  filePath?: string        // extract, split: single source file path
  filePaths?: string[]     // merge: ordered list of source file paths
  outputFolder: string     // pre-computed by main — worker writes here
  params: {
    pageIndices?: number[] // extract: 0-indexed page array
    splitMode?: 'parts' | 'maxPages'
    splitValue?: number    // parts: N outputs; maxPages: N pages per chunk
  }
}

function classifyError(err: unknown): { cause: string; fix: string } {
  if (err instanceof EncryptedPDFError) {
    return {
      cause: 'This PDF is password-protected.',
      fix: 'Remove the password before using PDF Chisel.'
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Failed to parse')) {
    return {
      cause: 'The PDF file appears to be corrupted.',
      fix: 'Try opening it in a PDF viewer first to verify it is readable.'
    }
  }
  if (msg.includes('EACCES') || msg.includes('EPERM') || msg.includes('permission')) {
    return {
      cause: 'Could not write output files: permission denied.',
      fix: 'Try choosing a different output folder (e.g., your Documents folder).'
    }
  }
  if (msg.includes('ENOSPC')) {
    return {
      cause: 'Not enough disk space to write output files.',
      fix: 'Free up disk space and try again.'
    }
  }
  return {
    cause: `Unexpected error: ${msg}`,
    fix: 'Try again. If the problem persists, restart the app.'
  }
}

async function run(): Promise<void> {
  const args = workerData as WorkerArgs
  const { operation, outputFolder } = args

  try {
    await mkdir(outputFolder, { recursive: true })

    if (operation === 'extract') {
      const { filePath, params } = args
      if (!filePath) throw new Error('filePath is required for extract')
      const { pageIndices = [] } = params

      const bytes = await readFile(filePath)
      parentPort!.postMessage({ type: 'progress', step: 'reading' })

      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })
      const newDoc = await PDFDocument.create()
      const pages = await newDoc.copyPages(srcDoc, pageIndices)
      for (const page of pages) {
        newDoc.addPage(page)
      }
      const outBytes = await newDoc.save()
      parentPort!.postMessage({ type: 'progress', step: 'processing' })

      const outFile = 'extracted.pdf'
      await writeFile(join(outputFolder, outFile), outBytes)
      parentPort!.postMessage({ type: 'progress', step: 'writing' })

      parentPort!.postMessage({
        type: 'complete',
        result: { outputFiles: [outFile], outputFolder }
      })
    } else if (operation === 'split') {
      const { filePath, params } = args
      if (!filePath) throw new Error('filePath is required for split')
      const { splitMode, splitValue = 2 } = params

      const bytes = await readFile(filePath)
      parentPort!.postMessage({ type: 'progress', step: 'reading' })

      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })
      const totalPages = srcDoc.getPageCount()

      let chunkSize: number
      if (splitMode === 'parts') {
        chunkSize = Math.ceil(totalPages / splitValue)
      } else {
        // maxPages
        chunkSize = splitValue
      }

      // Pre-compute number of chunks to determine zero-padding width
      const numChunks = Math.ceil(totalPages / chunkSize)
      const padWidth = numChunks > 9 ? 2 : 1

      const outputFiles: string[] = []
      let partIndex = 0
      let pageIndex = 0

      while (pageIndex < totalPages) {
        const end = Math.min(pageIndex + chunkSize, totalPages)
        const indices: number[] = []
        for (let i = pageIndex; i < end; i++) {
          indices.push(i)
        }

        const partDoc = await PDFDocument.create()
        const pages = await partDoc.copyPages(srcDoc, indices)
        for (const page of pages) {
          partDoc.addPage(page)
        }
        const partBytes = await partDoc.save()
        parentPort!.postMessage({ type: 'progress', step: 'processing' })

        partIndex++
        const partName = `part-${String(partIndex).padStart(padWidth, '0')}.pdf`
        await writeFile(join(outputFolder, partName), partBytes)
        outputFiles.push(partName)
        pageIndex = end
      }

      parentPort!.postMessage({ type: 'progress', step: 'writing' })
      parentPort!.postMessage({
        type: 'complete',
        result: { outputFiles, outputFolder }
      })
    } else if (operation === 'merge') {
      const { filePaths = [] } = args

      const mergedDoc = await PDFDocument.create()

      for (const fp of filePaths) {
        const bytes = await readFile(fp)
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })
        const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
        for (const page of pages) {
          mergedDoc.addPage(page)
        }
      }
      parentPort!.postMessage({ type: 'progress', step: 'reading' })
      parentPort!.postMessage({ type: 'progress', step: 'processing' })

      const outBytes = await mergedDoc.save()
      const outFile = 'merged.pdf'
      await writeFile(join(outputFolder, outFile), outBytes)
      parentPort!.postMessage({ type: 'progress', step: 'writing' })

      parentPort!.postMessage({
        type: 'complete',
        result: { outputFiles: [outFile], outputFolder }
      })
    } else {
      throw new Error(`Unknown operation: ${operation}`)
    }
  } catch (err) {
    parentPort!.postMessage({ type: 'error', error: classifyError(err) })
  }
}

run()
