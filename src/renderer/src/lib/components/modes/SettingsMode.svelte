<script lang="ts">
  import { onMount } from 'svelte'
  import { settingsState } from '../../stores/app.svelte'

  let outputPath = $state('')
  let autoOpen = $state(false)
  let appVersion = $state('')

  onMount(async () => {
    // settingsState is already populated by App.svelte onMount,
    // but mirror into local state for bound inputs
    outputPath = settingsState.outputPath
    autoOpen = settingsState.autoOpen
    appVersion = settingsState.appVersion
  })

  async function handlePathBlur() {
    settingsState.outputPath = outputPath
    await window.api.setSettings({ outputPath })
  }

  async function handleBrowse() {
    const chosen = await window.api.browseFolder()
    if (chosen !== null) {
      outputPath = chosen
      settingsState.outputPath = chosen
      await window.api.setSettings({ outputPath: chosen })
    }
  }

  async function handleAutoOpenToggle() {
    autoOpen = !autoOpen
    settingsState.autoOpen = autoOpen
    await window.api.setSettings({ autoOpen })
  }
</script>

<div class="mode-view">
  <h1 class="mode-title">Settings</h1>

  <div class="settings-body">
    <!-- Output section -->
    <section class="settings-section">
      <h2 class="section-heading">Output</h2>

      <div class="field">
        <label class="field-label" for="output-path">Default output folder</label>
        <div class="path-row">
          <input
            id="output-path"
            class="path-input"
            type="text"
            bind:value={outputPath}
            onblur={handlePathBlur}
            placeholder="~/Documents/PDF Chisel"
            spellcheck="false"
          />
          <button class="btn btn-secondary" onclick={handleBrowse}>Browse</button>
        </div>
        <p class="field-hint">Leave blank to use ~/Documents/PDF Chisel</p>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Auto-open output folder</span>
          <span class="toggle-hint">Open the output folder in Explorer after each operation</span>
        </div>
        <button
          class="toggle"
          class:on={autoOpen}
          role="switch"
          aria-checked={autoOpen}
          aria-label="Toggle auto-open output folder"
          onclick={handleAutoOpenToggle}
        >
          <span class="toggle-thumb"></span>
        </button>
      </div>
    </section>

    <div class="section-divider"></div>

    <!-- About section -->
    <section class="settings-section">
      <h2 class="section-heading">About</h2>
      <div class="about-row">
        <span class="about-label">Version</span>
        <span class="about-value">{appVersion || '—'}</span>
      </div>
      <div class="about-row">
        <span class="about-label">Releases</span>
        <a
          class="about-link"
          href="https://github.com/kelltom/pdf-chisel/releases"
          target="_blank"
          rel="noreferrer">View on GitHub</a
        >
      </div>
    </section>
  </div>
</div>

<style>
  .mode-view {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .mode-title {
    margin: 0 0 24px;
  }

  .settings-body {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 20px;
    max-width: 520px;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 0 0 24px;
  }

  .section-heading {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--color-surface-2);
    margin-bottom: 24px;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .path-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .path-input {
    flex: 1;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-surface-2);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    transition: border-color 0.15s;
  }

  .path-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .path-input::placeholder {
    color: var(--color-text-muted);
    font-family: inherit;
  }

  .btn {
    white-space: nowrap;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .toggle-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .toggle {
    flex-shrink: 0;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: var(--color-surface-2);
    border: none;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: background 0.2s;
  }

  .toggle.on {
    background: var(--color-accent);
  }

  .toggle-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition:
      transform 0.2s,
      background 0.2s;
    pointer-events: none;
  }

  .toggle.on .toggle-thumb {
    transform: translateX(18px);
    background: var(--color-bg);
  }

  .about-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .about-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    width: 72px;
    flex-shrink: 0;
  }

  .about-value {
    font-size: 0.875rem;
    color: var(--color-text);
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  }

  .about-link {
    font-size: 0.875rem;
    color: var(--color-accent);
    text-decoration: none;
  }

  .about-link:hover {
    text-decoration: underline;
  }
</style>
