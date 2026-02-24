<script lang="ts">
  import { appState, type Mode } from '../stores/app.svelte.ts'

  const modes: { id: Mode; label: string; icon: string }[] = [
    {
      id: 'extract',
      label: 'Extract',
      // Scissors icon
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>`
    },
    {
      id: 'split',
      label: 'Split',
      // Columns icon
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>`
    },
    {
      id: 'convert',
      label: 'Convert',
      // Image icon
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
    },
    {
      id: 'merge',
      label: 'Merge',
      // Merge icon (git merge)
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>`
    },
  ]
</script>

<nav class="nav-rail" aria-label="Mode navigation">
  <div class="nav-main">
    {#each modes as mode}
      <button
        class="nav-item"
        class:active={appState.currentMode === mode.id}
        title={mode.label}
        aria-label={mode.label}
        aria-pressed={appState.currentMode === mode.id}
        disabled={appState.isProcessing}
        onclick={() => appState.currentMode = mode.id}
      >
        {@html mode.icon}
        <span class="nav-label">{mode.label}</span>
      </button>
    {/each}
  </div>
  <div class="nav-footer">
    <button
      class="nav-item"
      class:active={appState.currentMode === 'settings'}
      title="Settings"
      aria-label="Settings"
      aria-pressed={appState.currentMode === 'settings'}
      onclick={() => appState.currentMode = 'settings'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      <span class="nav-label">Settings</span>
    </button>
  </div>
</nav>

<style>
  .nav-rail {
    width: var(--nav-rail-width);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-surface-2);
    flex-shrink: 0;
  }
  .nav-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .nav-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 4px;
  }
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 48px;
    padding: 8px 4px;
    border-radius: 8px;
    color: var(--color-text-muted);
    transition: color 0.15s, background 0.15s;
  }
  .nav-item:hover {
    color: var(--color-text);
    background: var(--color-surface-2);
  }
  .nav-item.active {
    color: var(--color-accent);
    background: rgba(137, 180, 250, 0.12);
  }
  .nav-label {
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .nav-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
