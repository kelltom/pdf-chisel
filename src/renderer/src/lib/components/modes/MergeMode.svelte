<script lang="ts">
  import FileInput from '../FileInput.svelte'
</script>
<div class="mode-view">
  <h1 class="mode-title">Merge PDFs</h1>
  <FileInput />
</div>
<style>
  .mode-view { display: flex; flex-direction: column; gap: 16px; }
  .mode-title { font-size: 20px; font-weight: 600; color: var(--color-text); }
</style>
