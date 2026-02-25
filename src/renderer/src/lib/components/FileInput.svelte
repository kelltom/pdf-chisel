<script lang="ts">
  import { appState } from '../stores/app.svelte.ts'

  let isDragOver = $state(false)
  let isLoading = $state(false)
  let errorMessage = $state<string | null>(null)

  async function openDialog() {
    errorMessage = null
    isLoading = true
    try {
      const result = await window.api.openPdf()
      if (result) {
        if (result.error) {
          errorMessage = `Could not read PDF: ${result.error}`
        } else {
          appState.currentFile = result
        }
      }
    } finally {
      isLoading = false
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    isDragOver = false
    errorMessage = null

    const files = Array.from(e.dataTransfer?.files ?? [])
    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))

    if (pdfFiles.length === 0) {
      errorMessage = 'Please drop a PDF file.'
      return
    }

    // webUtils.getPathForFile MUST be called via preload — File.path was removed in Electron 32
    const filePath = window.api.getPathForFile(pdfFiles[0])

    if (!filePath) {
      errorMessage = 'Could not resolve file path. Try using the Browse button instead.'
      return
    }

    isLoading = true
    try {
      const result = await window.api.getFileInfo(filePath)
      if (result) {
        if (result.error) {
          errorMessage = `Could not read PDF: ${result.error}`
        } else {
          appState.currentFile = result
        }
      }
    } finally {
      isLoading = false
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDragOver = true
  }

  function handleDragLeave() {
    isDragOver = false
  }
</script>

<div class="file-input-area">
  {#if appState.currentFile}
    <div class="file-info">
      <div class="file-icon">
        <!-- Document icon -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      </div>
      <div class="file-details">
        <span class="file-name">{appState.currentFile.fileName}</span>
        <span class="file-meta"
          >{appState.currentFile.pageCount}
          {appState.currentFile.pageCount === 1 ? 'page' : 'pages'}</span
        >
      </div>
      <button class="change-btn" onclick={openDialog} aria-label="Change file"> Change </button>
    </div>
  {:else}
    <div
      class="drop-zone"
      class:drag-over={isDragOver}
      role="region"
      aria-label="Drop zone for PDF files"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    >
      {#if isLoading}
        <span class="loading-text">Reading PDF...</span>
      {:else}
        <div class="drop-content">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: var(--color-text-muted)"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
          <p class="drop-hint">Drop a PDF here or</p>
          <button class="browse-btn" onclick={openDialog} disabled={isLoading}> Browse... </button>
        </div>
      {/if}
    </div>
  {/if}

  {#if errorMessage}
    <p class="error-msg" role="alert">{errorMessage}</p>
  {/if}
</div>

<style>
  .file-input-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .drop-zone {
    border: 2px dashed var(--color-surface-2);
    border-radius: 10px;
    padding: 16px 24px; /* reduced from 32px — min-height now controls minimum size */
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    transition:
      border-color 0.15s,
      background 0.15s;
    cursor: default;
  }
  .drop-zone.drag-over {
    border-color: var(--color-accent);
    background: rgba(137, 180, 250, 0.08);
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .drop-hint {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .browse-btn {
    padding: 6px 16px;
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 14px;
    font-weight: 500;
    transition: background 0.15s;
  }
  .browse-btn:hover {
    background: var(--color-accent-hover);
  }
  .browse-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-text {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    min-height: 80px;
    background: var(--color-surface);
    border: 1px solid var(--color-surface-2);
  }
  .file-icon {
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .file-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .file-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-meta {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .change-btn {
    flex-shrink: 0;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--color-text-muted);
    background: var(--color-surface-2);
    transition:
      color 0.15s,
      background 0.15s;
  }
  .change-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-2);
  }

  .error-msg {
    font-size: 13px;
    color: #f38ba8; /* Catppuccin red */
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(243, 139, 168, 0.1);
  }
</style>
