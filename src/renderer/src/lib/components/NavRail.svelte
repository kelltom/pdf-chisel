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
  {#each modes as mode}
    <button
      class="nav-item"
      class:active={appState.currentMode === mode.id}
      title={mode.label}
      aria-label={mode.label}
      aria-pressed={appState.currentMode === mode.id}
      onclick={() => appState.currentMode = mode.id}
    >
      {@html mode.icon}
      <span class="nav-label">{mode.label}</span>
    </button>
  {/each}
</nav>

<style>
  .nav-rail {
    width: var(--nav-rail-width);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    background: var(--color-surface);
    border-right: 1px solid var(--color-surface-2);
    flex-shrink: 0;
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
</style>
