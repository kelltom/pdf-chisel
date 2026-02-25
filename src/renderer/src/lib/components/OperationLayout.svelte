<script lang="ts">
  import ProgressSpinner from './ProgressSpinner.svelte'
  import ResultsSummary from './ResultsSummary.svelte'

  interface OperationResult {
    outputFiles?: string[]
    outputFolder?: string
    error?: { cause: string; fix: string }
  }

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
