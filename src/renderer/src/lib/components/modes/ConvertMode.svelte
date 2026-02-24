<script lang="ts">
  import { onDestroy } from 'svelte'
  import { appState } from '../../stores/app.svelte.ts'
  import OperationLayout from '../OperationLayout.svelte'
  import FileInput from '../FileInput.svelte'
  import ProgressSpinner from '../ProgressSpinner.svelte'
  import { renderPageToDataUrl } from '../../utils/pdf-renderer'

  type ReviewState = 'form' | 'reviewing' | 'complete'

  const DPI_PRESETS = [
    { value: 72,  label: '72',  hint: 'Screen' },
    { value: 96,  label: '96',  hint: 'Web' },
    { value: 150, label: '150', hint: 'General' },
    { value: 300, label: '300', hint: 'Print' },
  ] as const

  let format = $state<'png' | 'jpeg'>('png')
  let dpi = $state<number>(96)
  let isConverting = $state(false)
  let progressCurrent = $state(0)
  let progressTotal = $state(0)
  let outputFiles = $state<string[]>([])
  let outputFileNames = $state<string[]>([])
  let outputFolder = $state<string>('')
  let conversionError = $state<{ cause: string; fix: string } | null>(null)
  let reviewState = $state<ReviewState>('form')
  let hasConversionResult = $state(false)

  // Clear state when navigating away from convert mode
  $effect(() => {
    if (appState.currentMode !== 'convert') {
      reviewState = 'form'
    }
  })

  async function execute() {
    if (!appState.currentFile) return
    appState.isProcessing = true
    isConverting = true
    progressCurrent = 0
    progressTotal = appState.currentFile.pageCount
    outputFiles = []
    outputFileNames = []
    conversionError = null
    hasConversionResult = false

    try {
      const folder = await window.api.makeConvertOutputFolder()
      outputFolder = folder

      const rawBytes = await window.api.readFileBytes(appState.currentFile.filePath)
      // IPC sends a Buffer which arrives as a plain object in the renderer — convert to Uint8Array
      const pdfBytes = rawBytes instanceof Uint8Array
        ? rawBytes
        : new Uint8Array(Object.values(rawBytes as unknown as Record<string, number>))

      const totalPages = appState.currentFile.pageCount
      const padWidth = totalPages > 99 ? 3 : totalPages > 9 ? 2 : 1
      const ext = format === 'jpeg' ? 'jpg' : 'png'

      for (let i = 1; i <= totalPages; i++) {
        progressCurrent = i
        const dataUrl = await renderPageToDataUrl(pdfBytes, i, dpi, format)
        const fileName = `page-${String(i).padStart(padWidth, '0')}.${ext}`
        const filePath = await window.api.writeImageFile({ dataUrl, outputFolder: folder, fileName })
        outputFiles = [...outputFiles, filePath]
        outputFileNames = [...outputFileNames, fileName]
      }

      hasConversionResult = true
      // Auto-open output folder (matches Phase 2 ResultsSummary behavior)
      window.api.openOutputFolder(folder)
    } catch (err) {
      conversionError = {
        cause: err instanceof Error ? err.message : String(err),
        fix: 'Try a different PDF file or reduce the DPI setting.'
      }
      hasConversionResult = true
    } finally {
      isConverting = false
      appState.isProcessing = false
    }
  }

  function reset() {
    format = 'png'
    dpi = 96
    isConverting = false
    progressCurrent = 0
    progressTotal = 0
    outputFiles = []
    outputFileNames = []
    outputFolder = ''
    conversionError = null
    reviewState = 'form'
    hasConversionResult = false
  }

  onDestroy(() => {
    if (isConverting) appState.isProcessing = false
  })
</script>

<div class="mode-view">
  {#if reviewState === 'form'}
    <h1 class="mode-title">Convert to Images</h1>
    <OperationLayout isProcessing={false} result={null} onReset={reset}>
      {#snippet inputs()}
        <FileInput />

        <!-- Format selector: segmented toggle matching Split mode pattern -->
        <div class="field">
          <span class="field-label">Output format</span>
          <div class="format-selector" role="group" aria-label="Output format">
            <button
              class="mode-btn"
              class:active={format === 'png'}
              onclick={() => format = 'png'}
              disabled={isConverting}
              aria-pressed={format === 'png'}
            >
              PNG
            </button>
            <button
              class="mode-btn"
              class:active={format === 'jpeg'}
              onclick={() => format = 'jpeg'}
              disabled={isConverting}
              aria-pressed={format === 'jpeg'}
            >
              JPEG
            </button>
          </div>
          <p class="format-hint">
            {#if format === 'png'}PNG: lossless, larger files{:else}JPEG: compressed, smaller files{/if}
          </p>
        </div>

        <!-- DPI selector: segmented buttons with hints as secondary labels -->
        <div class="field">
          <span class="field-label">Resolution (DPI)</span>
          <div class="dpi-selector" role="group" aria-label="DPI preset">
            {#each DPI_PRESETS as preset}
              <button
                class="dpi-btn"
                class:active={dpi === preset.value}
                onclick={() => dpi = preset.value}
                disabled={isConverting}
                aria-pressed={dpi === preset.value}
              >
                <span class="dpi-value">{preset.label}</span>
                <span class="dpi-hint">{preset.hint}</span>
              </button>
            {/each}
          </div>
        </div>
      {/snippet}

      {#snippet actions()}
        <button
          class="btn-primary"
          onclick={execute}
          disabled={isConverting || !appState.currentFile}
        >
          Convert
        </button>
      {/snippet}
    </OperationLayout>

    <!-- Progress area — shown during conversion -->
    {#if isConverting}
      <div class="progress-area">
        <ProgressSpinner />
        <span class="progress-label">
          {progressCurrent > 0 ? `Page ${progressCurrent} of ${progressTotal}` : 'Starting...'}
        </span>
      </div>
    {/if}

    <!-- Post-conversion results — custom section to accommodate Start Review button -->
    {#if hasConversionResult && !isConverting}
      <div class="convert-results">
        {#if conversionError}
          <div class="error-panel" role="alert">
            <p class="error-cause">{conversionError.cause}</p>
            <p class="error-fix">{conversionError.fix}</p>
          </div>
        {:else}
          <div class="success-panel">
            <p class="success-label">
              {outputFileNames.length} file{outputFileNames.length !== 1 ? 's' : ''} created
            </p>
            <ul class="file-list">
              {#each outputFileNames as name}
                <li class="file-item">{name}</li>
              {/each}
            </ul>
            <div class="result-actions">
              <button class="btn btn-secondary" onclick={() => window.api.openOutputFolder(outputFolder)}>
                Open Folder
              </button>
              <button class="btn btn-primary-sm" onclick={() => reviewState = 'reviewing'}>
                Start Review
              </button>
            </div>
          </div>
        {/if}
        <button class="btn btn-reset" onclick={reset}>Reset</button>
      </div>
    {/if}

  {:else if reviewState === 'reviewing'}
    <!-- Review workflow — implemented in Plan 03-03 -->
    <div class="placeholder-view">
      <p class="placeholder-text">Review workflow coming in Plan 03-03</p>
    </div>

  {:else if reviewState === 'complete'}
    <!-- Completion screen — implemented in Plan 03-03 -->
    <div class="placeholder-view">
      <p class="placeholder-text">Completion screen coming in Plan 03-03</p>
    </div>
  {/if}
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

  /* Format and DPI selectors share the Split mode segmented button pattern */
  .format-selector,
  .dpi-selector {
    display: flex;
    gap: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-surface-2);
    width: fit-content;
  }

  .mode-btn {
    padding: 8px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: none;
    border-right: 1px solid var(--color-surface-2);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .mode-btn:last-child {
    border-right: none;
  }

  .mode-btn:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-surface-2);
  }

  .mode-btn.active {
    color: var(--color-bg);
    background: var(--color-accent);
  }

  .mode-btn.active:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .mode-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* DPI buttons: two-line layout (value + hint stacked) */
  .dpi-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 18px;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: none;
    border-right: 1px solid var(--color-surface-2);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    gap: 2px;
  }

  .dpi-btn:last-child {
    border-right: none;
  }

  .dpi-btn:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-surface-2);
  }

  .dpi-btn.active {
    color: var(--color-bg);
    background: var(--color-accent);
  }

  .dpi-btn.active:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .dpi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dpi-value {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .dpi-hint {
    font-size: 0.6875rem;
    opacity: 0.8;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .format-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  /* Progress area — shown during conversion */
  .progress-area {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
  }

  .progress-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  /* Custom results section (below OperationLayout) */
  .convert-results {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 20px 20px;
  }

  .error-panel {
    background: color-mix(in srgb, #f38ba8 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, #f38ba8 40%, transparent);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .error-cause {
    color: #f38ba8;
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0;
  }

  .error-fix {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    margin: 0;
  }

  .success-panel {
    background: color-mix(in srgb, #a6e3a1 8%, var(--color-surface));
    border: 1px solid color-mix(in srgb, #a6e3a1 30%, transparent);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .success-label {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    font-weight: 500;
    margin: 0;
  }

  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-item {
    font-size: 0.8125rem;
    color: var(--color-text);
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 20px;
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Smaller primary button for results section */
  .btn-primary-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary-sm:hover {
    background: var(--color-accent-hover);
  }

  .btn-secondary {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  .btn-reset {
    background: var(--color-surface);
    color: var(--color-text-muted);
    align-self: flex-start;
    border: 1px solid var(--color-surface-2);
  }

  .btn-reset:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  /* Placeholder views for review/complete states (Plan 03-03) */
  .placeholder-view {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 40px 20px;
  }

  .placeholder-text {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }
</style>
