<script lang="ts">
  import ProgressSpinner from './ProgressSpinner.svelte'
  import { appState } from '../stores/app.svelte'
  import ResultsSummary from './ResultsSummary.svelte'
  import type { OperationResult } from '../types/operation.ts'

  let {
    isProcessing = false,
    result = null,
    inputs,
    actions
  }: {
    isProcessing?: boolean
    result?: OperationResult | null
    inputs?: import('svelte').Snippet
    actions?: import('svelte').Snippet
  } = $props()
</script>

<div class="operation-layout">
  <div class="inputs-area">
    <div class="field">
      <label for="file-prefix">File Prefix</label>
      <input
        id="file-prefix"
        type="text"
        placeholder="e.g. lecture"
        bind:value={appState.filePrefix}
        disabled={appState.isProcessing}
      />
    </div>
    {@render inputs?.()}
  </div>

  <div class="actions-area">
    {@render actions?.()}
  </div>

  {#if isProcessing}
    <div class="progress-area">
      <ProgressSpinner />
      <span class="processing-label">Processing...</span>
    </div>
  {/if}

  <div class="results-area">
    <ResultsSummary {result} />
  </div>
</div>

<style>
  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  input {
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-surface-2);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: inherit;
  }

  input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input::placeholder {
    color: var(--color-text-muted);
  }

  .operation-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    /* height: 100% and overflow-y: auto removed — these fight the parent scroll model.
       The parent main.content in App.svelte owns the scroll region. */
  }

  .inputs-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .actions-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-area {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
  }

  .processing-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .results-area {
    display: flex;
    flex-direction: column;
  }
</style>
