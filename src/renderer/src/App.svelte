<script lang="ts">
  import { appState } from './lib/stores/app.svelte.ts'
  import AppBar from './lib/components/AppBar.svelte'
  import NavRail from './lib/components/NavRail.svelte'
  import ExtractMode from './lib/components/modes/ExtractMode.svelte'
  import SplitMode from './lib/components/modes/SplitMode.svelte'
  import ConvertMode from './lib/components/modes/ConvertMode.svelte'
  import MergeMode from './lib/components/modes/MergeMode.svelte'
  import SettingsMode from './lib/components/modes/SettingsMode.svelte'
</script>

<div class="shell">
  <AppBar />
  <div class="body">
    <NavRail />
    <main class="content">
      {#if appState.currentMode === 'extract'}
        <ExtractMode />
      {:else if appState.currentMode === 'split'}
        <SplitMode />
      {:else if appState.currentMode === 'convert'}
        <ConvertMode />
      {:else if appState.currentMode === 'merge'}
        <MergeMode />
      {:else if appState.currentMode === 'settings'}
        <SettingsMode />
      {/if}
    </main>
  </div>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    background: var(--color-bg);
  }
</style>
