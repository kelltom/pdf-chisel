<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { appState } from '../../stores/app.svelte.ts'
  import OperationLayout from '../OperationLayout.svelte'
  import FileInput from '../FileInput.svelte'
  import type { OperationResult } from '../../types/operation.ts'

  let splitMode = $state<'parts' | 'maxPages'>('parts')
  let splitValue = $state<number>(2)
  let isProcessing = $state(false)
  let operationResult = $state<OperationResult | null>(null)

  // Clear results when navigating away from split mode
  $effect(() => {
    if (appState.currentMode !== 'split') {
      operationResult = null
    }
  })

  onMount(async () => {
    const saved = await window.api.getSplitState()
    splitMode = saved.mode
    splitValue = saved.value
  })

  let cleanupProgress: (() => void) | null = null

  async function execute() {
    if (!appState.currentFile) return
    appState.isProcessing = true
    isProcessing = true
    operationResult = null

    // Persist last-used split settings silently
    await window.api.setSplitState({ mode: splitMode, value: splitValue })

    cleanupProgress = window.api.onProgress((_data) => { /* indeterminate only */ })

    const result = await window.api.splitPdf({
      operation: 'split',
      filePath: appState.currentFile.filePath,
      params: { splitMode, splitValue }
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

  function reset() {
    splitMode = 'parts'
    splitValue = 2
    operationResult = null
    appState.currentFile = null  // Reset unloads the file — returns to blank state (Phase 5 decision)
  }

  function clampSplitValue() {
    const min = splitMode === 'parts' ? 2 : 1
    if (!splitValue || splitValue < min) {
      splitValue = min
    }
  }
</script>

<div class="mode-view">
  <h1 class="mode-title">Split PDF</h1>

  <OperationLayout {isProcessing} result={operationResult}>
  {#snippet inputs()}
    <FileInput />
    <div class="split-controls">
      <div class="mode-selector" role="group" aria-label="Split mode">
        <button
          class="mode-btn"
          class:active={splitMode === 'parts'}
          onclick={() => { splitMode = 'parts'; if (splitValue < 2) splitValue = 2 }}
          disabled={isProcessing}
          aria-pressed={splitMode === 'parts'}
        >
          By number of parts
        </button>
        <button
          class="mode-btn"
          class:active={splitMode === 'maxPages'}
          onclick={() => { splitMode = 'maxPages'; if (splitValue < 1) splitValue = 1 }}
          disabled={isProcessing}
          aria-pressed={splitMode === 'maxPages'}
        >
          Max pages per file
        </button>
      </div>

      <div class="field">
        <label class="field-label" for="split-value">
          {splitMode === 'parts' ? 'Number of parts' : 'Max pages per file'}
        </label>
        <input
          id="split-value"
          class="number-input"
          type="number"
          min={splitMode === 'parts' ? 2 : 1}
          step="1"
          bind:value={splitValue}
          onblur={clampSplitValue}
          disabled={isProcessing}
        />
      </div>
    </div>
  {/snippet}

  {#snippet actions()}
    <button
      class="btn-primary"
      onclick={execute}
      disabled={isProcessing || !appState.currentFile || splitValue < 1}
    >
      Split
    </button>
    <button class="btn-reset" onclick={reset}>Reset</button>
  {/snippet}
  </OperationLayout>
</div>

<style>
  .mode-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .split-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mode-selector {
    display: flex;
    gap: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-surface-2);
    width: fit-content;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: fit-content;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .number-input {
    width: 100px;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-surface-2);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.9375rem;
    font-weight: 500;
    transition: border-color 0.15s;
  }

  .number-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .number-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--color-surface);
    color: var(--color-text-muted);
    border: 1px solid var(--color-surface-2);
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-reset:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }
</style>
