<script lang="ts">
  import { settingsState } from '../stores/app.svelte.ts'

  interface OperationResult {
    outputFiles?: string[]
    outputFolder?: string
    error?: { cause: string; fix: string }
  }

  let {
    result = null,
    onReset
  }: {
    result?: OperationResult | null
    onReset: () => void
  } = $props()

  // Auto-open output folder on success — gated by user's auto-open setting (SETT-02)
  $effect(() => {
    if (result?.outputFolder && !result.error && settingsState.autoOpen) {
      window.api.openOutputFolder(result.outputFolder)
    }
  })

  function openOutputFolder() {
    if (result?.outputFolder) {
      window.api.openOutputFolder(result.outputFolder)
    }
  }
</script>

<div class="results-summary">
  {#if result?.error}
    <div class="error-panel" role="alert">
      <p class="error-cause">{result.error.cause}</p>
      <p class="error-fix">{result.error.fix}</p>
    </div>
  {:else if result?.outputFiles && result.outputFiles.length > 0}
    <div class="success-panel">
      <p class="success-label">Output files:</p>
      <ul class="file-list">
        {#each result.outputFiles as file}
          <li class="file-item">{file}</li>
        {/each}
      </ul>
      <button class="btn btn-secondary" onclick={openOutputFolder}>
        Open Folder
      </button>
    </div>
  {/if}

  <button class="btn btn-reset" onclick={onReset}>
    Reset
  </button>
</div>

<style>
  .results-summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  }

  .error-fix {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
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
  }

  .file-list {
    list-style: none;
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

  .btn-secondary {
    background: var(--color-surface-2);
    color: var(--color-text);
    align-self: flex-start;
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
</style>
