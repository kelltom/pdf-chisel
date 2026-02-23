<script lang="ts">
  import { appState } from '../../stores/app.svelte.ts'
  import { onDestroy } from 'svelte'
  import OperationLayout from '../OperationLayout.svelte'

  interface FileItem {
    id: string
    filePath: string
    fileName: string
  }

  interface OperationResult {
    outputFiles?: string[]
    outputFolder?: string
    error?: { cause: string; fix: string }
  }

  let files = $state<FileItem[]>([])
  let dragIndex = $state<number | null>(null)
  let isProcessing = $state(false)
  let operationResult = $state<OperationResult | null>(null)
  let isDragOver = $state(false)

  $effect(() => {
    if (appState.currentMode !== 'merge') {
      operationResult = null
    }
  })

  async function addFiles() {
    const paths = await window.api.openPdfsDialog()
    const newItems: FileItem[] = paths.map(p => ({
      id: crypto.randomUUID(),
      filePath: p,
      fileName: p.split(/[\\/]/).pop() ?? p
    }))
    files = [...files, ...newItems]
  }

  function removeFile(id: string) {
    files = files.filter(f => f.id !== id)
  }

  function reset() {
    files = []
    operationResult = null
  }

  function ondragstart(i: number) {
    dragIndex = i
  }

  function ondragover(e: DragEvent, i: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== i) {
      const reordered = [...files]
      const [moved] = reordered.splice(dragIndex, 1)
      reordered.splice(i, 0, moved)
      files = reordered
      dragIndex = i
    }
  }

  function ondragend() {
    dragIndex = null
  }

  async function onDropZone(e: DragEvent) {
    e.preventDefault()
    isDragOver = false
    const droppedFiles = Array.from(e.dataTransfer?.files ?? [])
    const pdfFiles = droppedFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'))
    const newItems: FileItem[] = pdfFiles.map(f => ({
      id: crypto.randomUUID(),
      filePath: window.api.getPathForFile(f),
      fileName: f.name
    }))
    if (newItems.length > 0) {
      files = [...files, ...newItems]
    }
  }

  let cleanupProgress: (() => void) | null = null

  async function execute() {
    if (files.length < 2) return
    appState.isProcessing = true
    isProcessing = true
    operationResult = null

    cleanupProgress = window.api.onProgress((_data) => { /* indeterminate only */ })

    const result = await window.api.mergePdfs({
      operation: 'merge',
      filePaths: files.map(f => f.filePath)
    })

    cleanupProgress?.()
    cleanupProgress = null
    operationResult = result
    isProcessing = false
    appState.isProcessing = false
  }

  onDestroy(() => {
    cleanupProgress?.()
    if (isProcessing) appState.isProcessing = false
  })
</script>

<div class="mode-view">
  <h1 class="mode-title">Merge PDFs</h1>

  <OperationLayout {isProcessing} result={operationResult} onReset={reset}>
  {#snippet inputs()}
    <div class="merge-inputs">
      <button onclick={addFiles} disabled={isProcessing} class="btn-secondary">
        Add Files
      </button>

      <div
        class="file-list-container"
        class:drag-over={isDragOver}
        ondragover={(e) => { e.preventDefault(); isDragOver = true }}
        ondragleave={() => { isDragOver = false }}
        ondrop={onDropZone}
      >
        {#if files.length === 0}
          <p class="empty-hint">No files added. Click "Add Files" or drop PDFs here.</p>
        {:else}
          <ol class="file-list">
            {#each files as file, i (file.id)}
              <li
                class="file-item"
                class:dragging={dragIndex === i}
                draggable="true"
                ondragstart={() => ondragstart(i)}
                ondragover={(e) => ondragover(e, i)}
                ondragend={ondragend}
              >
                <span class="drag-handle" aria-hidden="true">⠿</span>
                <span class="file-name">{file.fileName}</span>
                <button
                  class="remove-btn"
                  onclick={() => removeFile(file.id)}
                  disabled={isProcessing}
                  aria-label="Remove {file.fileName}"
                >×</button>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet actions()}
    <button
      onclick={execute}
      disabled={isProcessing || files.length < 2}
      class="btn-primary"
    >
      Merge
    </button>
  {/snippet}
  </OperationLayout>
</div>

<style>
  .mode-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .mode-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
    padding: 20px 20px 0;
    margin: 0;
  }

  .merge-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-secondary {
    align-self: flex-start;
    padding: 6px 14px;
    border-radius: 6px;
    background: var(--color-surface-2);
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn-secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-surface-2) 80%, var(--color-accent) 20%);
  }

  .btn-secondary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-primary {
    padding: 6px 18px;
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.875rem;
    font-weight: 600;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .file-list-container {
    min-height: 120px;
    border: 2px dashed var(--color-surface-2);
    border-radius: 8px;
    padding: 8px;
    transition: border-color 0.15s, background 0.15s;
  }

  .file-list-container.drag-over {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-bg) 92%, var(--color-accent) 8%);
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 96px;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    text-align: center;
    padding: 16px;
  }

  .file-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--color-surface);
    border: 1px solid transparent;
    cursor: grab;
    user-select: none;
    transition: background 0.1s, border-color 0.1s, opacity 0.1s;
  }

  .file-item:hover {
    background: var(--color-surface-2);
    border-color: color-mix(in srgb, var(--color-surface-2) 60%, var(--color-accent) 40%);
  }

  .file-item.dragging {
    opacity: 0.5;
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-surface) 80%, var(--color-accent) 20%);
    cursor: grabbing;
  }

  .drag-handle {
    color: var(--color-text-muted);
    font-size: 1rem;
    flex-shrink: 0;
    cursor: grab;
  }

  .file-item.dragging .drag-handle {
    cursor: grabbing;
  }

  .file-name {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-btn {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
    transition: color 0.1s, background 0.1s;
  }

  .remove-btn:hover:not(:disabled) {
    color: color-mix(in srgb, var(--color-text) 100%, red 30%);
    background: color-mix(in srgb, var(--color-surface-2) 70%, red 30%);
  }

  .remove-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
