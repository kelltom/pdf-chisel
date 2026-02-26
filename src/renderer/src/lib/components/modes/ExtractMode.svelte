<script lang="ts">
  import { onDestroy } from 'svelte'
  import { appState } from '../../stores/app.svelte'
  import { parsePageRange } from '../../utils/page-range'
  import OperationLayout from '../OperationLayout.svelte'
  import FileInput from '../FileInput.svelte'
  import type { OperationResult } from '../../types/operation.ts'

  let pageRangeInput = $state('')
  let operationResult = $state<OperationResult | null>(null)

  let cleanupProgress: (() => void) | null = null

  // Clear results when switching away from extract mode
  $effect(() => {
    if (appState.currentMode !== 'extract') {
      operationResult = null
    }
  })

  async function execute() {
    if (!appState.currentFile) return
    appState.isProcessing = true
    operationResult = null

    cleanupProgress = window.api.onProgress((_data) => {
      // Indeterminate spinner already shown via isProcessing
      // Progress step messages are no-op in Phase 2 (indeterminate only)
    })

    const pageIndices = parsePageRange(pageRangeInput, appState.currentFile.pageCount)
    const result = await window.api.extractPages({
      operation: 'extract',
      filePath: appState.currentFile.filePath,
      params: { pageIndices }
    })

    cleanupProgress?.()
    cleanupProgress = null
    operationResult = result
    appState.isProcessing = false
  }

  function reset() {
    pageRangeInput = ''
    operationResult = null
    appState.currentFile = null // Reset unloads the file — returns to blank state (Phase 5 decision)
  }

  function onPageRangeBlur() {
    // Validation happens on execute; out-of-range pages are silently clamped/excluded
    // This handler is a no-op per locked decision: validate on blur, not live
  }

  onDestroy(() => {
    cleanupProgress?.()
    appState.isProcessing = false
  })
</script>

<div class="mode-view">
  <h1 class="mode-title">Extract Pages</h1>

  <OperationLayout isProcessing={appState.isProcessing} result={operationResult}>
    {#snippet inputs()}
      <FileInput />
      <div class="field">
        <label for="page-range">Page range</label>
        <input
          id="page-range"
          type="text"
          placeholder="e.g. 1-5, 8, 12-15"
          bind:value={pageRangeInput}
          onblur={onPageRangeBlur}
          disabled={appState.isProcessing}
        />
        <p class="hint">Leave empty to extract all pages</p>
      </div>
    {/snippet}

    {#snippet actions()}
      <button
        class="btn-primary"
        onclick={execute}
        disabled={appState.isProcessing || !appState.currentFile}
      >
        Extract
      </button>
      <button class="btn-reset" onclick={reset}>Reset</button>
    {/snippet}
  </OperationLayout>
</div>

<style>
  .mode-view {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  input[type='text'] {
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-surface-2);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type='text']:focus {
    border-color: var(--color-accent);
  }

  input[type='text']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type='text']::placeholder {
    color: var(--color-text-muted);
  }

  .hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }

</style>
