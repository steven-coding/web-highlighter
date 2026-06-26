<script lang="ts">
  let count = $state<number | null>(null);
  let pageUrl = $state('');
  let exporting = $state(false);
  let exportDone = $state(false);

  $effect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id || !tab.url) return;
      pageUrl = tab.url;
      chrome.tabs
        .sendMessage(tab.id, { type: 'page/info' })
        .then((res: { count: number; url: string }) => {
          count = res?.count ?? 0;
          pageUrl = res?.url ?? pageUrl;
        })
        .catch(() => {
          count = 0;
        });
    });
  });

  async function openLibrary() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: 'library/toggle' });
    window.close();
  }

  async function exportMarkdown() {
    exporting = true;
    exportDone = false;
    await chrome.runtime.sendMessage({ type: 'export/markdown', payload: { url: pageUrl } });
    exporting = false;
    exportDone = true;
    setTimeout(() => (exportDone = false), 2000);
  }
</script>

<div class="popup">
  <h1 class="title">Web Highlighter</h1>

  <div class="stat">
    <span class="stat-num">{count === null ? '…' : count}</span>
    <span class="stat-label">Highlight{count === 1 ? '' : 's'} auf dieser Seite</span>
  </div>

  <div class="actions">
    <button class="btn" onclick={openLibrary}>
      📚 Bibliothek öffnen
    </button>
    <button class="btn btn-secondary" onclick={exportMarkdown} disabled={exporting}>
      {#if exportDone}
        ✓ Exportiert!
      {:else if exporting}
        Exportiere…
      {:else}
        ⬇ Als Markdown exportieren
      {/if}
    </button>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
  .popup {
    width: 240px;
    padding: 16px;
    color: #111827;
  }
  .title {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 700;
    color: #6366f1;
  }
  .stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 16px;
    padding: 10px 12px;
    background: #f5f3ff;
    border-radius: 8px;
  }
  .stat-num {
    font-size: 24px;
    font-weight: 700;
    color: #4f46e5;
  }
  .stat-label {
    font-size: 12px;
    color: #6b7280;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .btn {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #6366f1;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }
  .btn:hover { background: #4f46e5; }
  .btn:disabled { opacity: .6; cursor: default; }
  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #e5e7eb;
  }
  .btn-secondary:hover { background: #e5e7eb; }
</style>
