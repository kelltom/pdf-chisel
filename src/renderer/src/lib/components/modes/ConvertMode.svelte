<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { appState, settingsState } from '../../stores/app.svelte.ts'
  import OperationLayout from '../OperationLayout.svelte'
  import FileInput from '../FileInput.svelte'
  import ProgressSpinner from '../ProgressSpinner.svelte'
  import ResultsSummary from '../ResultsSummary.svelte'
  import { loadPdfDocument, renderPageFromDoc } from '../../utils/pdf-renderer'
  import type { OperationResult } from '../../types/operation.ts'

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

  // Review workflow state
  let currentIndex = $state(0)
  let isFlashing = $state(false)
  let imageLoadError = $state(false)

  // Unified result object for ResultsSummary — uses basenames for a clean display
  const conversionResult = $derived<OperationResult | null>(
    hasConversionResult && !isConverting
      ? conversionError
        ? { error: conversionError }
        : { outputFiles: outputFileNames, outputFolder }
      : null
  )

  // currentImagePath: absolute path of the currently-displayed image
  // Windows paths use backslashes; file:// needs forward slashes
  const currentImagePath = $derived(
    outputFiles.length > 0
      ? outputFiles[currentIndex].replace(/\\/g, '/')
      : ''
  )

  // Reset imageLoadError when index changes
  $effect(() => { currentIndex; imageLoadError = false })

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

    // Persist last-used convert settings silently
    await window.api.setConvertState({ format, dpi })

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

      const pdf = await loadPdfDocument(pdfBytes)
      try {
        for (let i = 1; i <= totalPages; i++) {
          progressCurrent = i
          const dataUrl = await renderPageFromDoc(pdf, i, dpi, format)
          const fileName = `page-${String(i).padStart(padWidth, '0')}.${ext}`
          const filePath = await window.api.writeImageFile({ dataUrl, outputFolder: folder, fileName })
          outputFiles = [...outputFiles, filePath]
          outputFileNames = [...outputFileNames, fileName]
        }
      } finally {
        pdf.destroy()
      }

      hasConversionResult = true
      // Auto-open output folder — gated by user's auto-open setting (SETT-02)
      if (settingsState.autoOpen) {
        window.api.openOutputFolder(folder)
      }
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

  async function copyAndNext(): Promise<void> {
    if (!currentImagePath || isConverting) return

    // Flash animation: set true, reset after 200ms
    isFlashing = true
    setTimeout(() => { isFlashing = false }, 200)

    // Copy current image to clipboard via IPC (pass file path, not data URL)
    try {
      await window.api.copyImageToClipboard(outputFiles[currentIndex])
    } catch (err) {
      console.error('Clipboard write failed:', err)
      // Continue advancing even if clipboard fails — don't block review flow
    }

    if (currentIndex >= outputFiles.length - 1) {
      // Last image reached — transition to completion screen
      reviewState = 'complete'
    } else {
      currentIndex++
    }
  }

  function goBack(): void {
    if (currentIndex > 0) {
      currentIndex--
    }
  }

  function startReview(): void {
    currentIndex = 0
    reviewState = 'reviewing'
  }

  function closeReview(): void {
    // Return to form view; results summary remains visible
    reviewState = 'form'
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
    currentIndex = 0
    isFlashing = false
    imageLoadError = false
    appState.currentFile = null  // Reset unloads the file — returns to blank state (Phase 5 decision)
  }

  onMount(async () => {
    const saved = await window.api.getConvertState()
    format = saved.format
    dpi = saved.dpi
  })

  onDestroy(() => {
    if (isConverting) appState.isProcessing = false
  })
</script>

<svelte:window onkeydown={(e) => {
  if (reviewState === 'reviewing' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    copyAndNext()
  }
}} />

<div class="mode-view">
  {#if reviewState === 'form'}
    <h1 class="mode-title">Convert to Images</h1>
    <OperationLayout isProcessing={false} result={null}>
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
        <button class="btn-reset" onclick={reset}>Reset</button>
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

    <!-- Post-conversion results — uses shared ResultsSummary; Start Review injected via extraActions -->
    {#if hasConversionResult && !isConverting}
      <div class="convert-results">
        <ResultsSummary result={conversionResult}>
          {#snippet extraActions()}
            {#if !conversionError}
              <button class="btn-primary-sm" onclick={startReview}>
                Start Review
              </button>
            {/if}
          {/snippet}
        </ResultsSummary>
      </div>
    {/if}

  {:else if reviewState === 'reviewing'}
    <div class="review-container">
      <div class="review-header">
        <span class="review-position">{currentIndex + 1} / {outputFiles.length}</span>
        <button class="btn btn-secondary btn-close-review" onclick={closeReview}>Close</button>
      </div>

      <div class="review-image-area">
        {#if currentImagePath}
          <img
            src="file://{currentImagePath}"
            alt="Page {currentIndex + 1}"
            class="review-image"
            class:flash={isFlashing}
            onerror={() => imageLoadError = true}
            style={imageLoadError ? 'display: none' : ''}
          />
          {#if imageLoadError}
            <div class="review-placeholder">Image could not be loaded</div>
          {/if}
        {:else}
          <div class="review-placeholder">No image available</div>
        {/if}
      </div>

      <div class="review-actions">
        <button
          class="btn btn-secondary"
          onclick={goBack}
          disabled={currentIndex === 0}
        >
          Back
        </button>
        <button
          class="btn btn-primary"
          onclick={copyAndNext}
        >
          Copy and Next
        </button>
      </div>
    </div>

  {:else if reviewState === 'complete'}
    <div class="complete-container">
      <div class="complete-content">
        <p class="complete-message">Review complete — {outputFiles.length} image{outputFiles.length !== 1 ? 's' : ''} copied</p>
        <button class="btn btn-secondary" onclick={closeReview}>
          Close
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .mode-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;       /* flex child must have min-height: 0 to scroll rather than expand */
    overflow-y: auto;    /* ConvertMode owns its scroll region */
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

  /* Results section wrapper — provides padding, ResultsSummary handles internal layout */
  .convert-results {
    padding: 0 20px 20px;
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

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  .btn-secondary:disabled {
    opacity: 0.4;
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

  /* Review container: fills the mode-view, nav rail stays visible */
  .review-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    flex-shrink: 0;
  }

  .btn-close-review {
    padding: 4px 12px;
    font-size: 0.8125rem;
  }

  .review-position {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  /* Image area: grows to fill available space, centers image */
  .review-image-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 8px 20px;
    min-height: 0;  /* Required for flex child to shrink below content size */
  }

  .review-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
    border-radius: 4px;
  }

  /* Flash animation for Copy confirmation */
  .review-image.flash {
    animation: flash-anim 0.2s ease-out;
  }

  @keyframes flash-anim {
    0%   { opacity: 1; }
    50%  { opacity: 0.35; }
    100% { opacity: 1; }
  }

  .review-placeholder {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .review-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 20px;
    flex-shrink: 0;
  }

  /* Completion screen */
  .complete-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .complete-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .complete-message {
    font-size: 1rem;
    color: var(--color-text);
  }
</style>
