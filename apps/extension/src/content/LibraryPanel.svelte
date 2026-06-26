<script lang="ts">
  import type { Annotation } from '@highlighter/core';

  let {
    url,
    onClose,
    onDelete,
    onScrollTo,
    onEditNote,
  }: {
    url: string;
    onClose: () => void;
    onDelete: (id: string) => void;
    onScrollTo: (id: string) => void;
    onEditNote: (id: string) => void;
  } = $props();

  let annotations = $state<Annotation[]>([]);
  let editingId = $state<string | null>(null);
  let editNote = $state('');
  let loading = $state(true);

  const sortedAnnotations = $derived(
    [...annotations].sort((a, b) => {
      const aPos = a.textPosition?.start ?? Infinity;
      const bPos = b.textPosition?.start ?? Infinity;
      return aPos - bPos;
    }),
  );

  $effect(() => {
    chrome.runtime.sendMessage({ type: 'annotation/listByUrl', payload: { url } }).then(
      (res: Annotation[]) => {
        annotations = res;
        loading = false;
      },
    );
  });

  async function startEdit(a: Annotation) {
    editingId = a.id;
    editNote = a.note;
  }

  async function saveEdit(id: string) {
    const updated: Annotation = await chrome.runtime.sendMessage({
      type: 'annotation/update',
      payload: { id, note: editNote },
    });
    annotations = annotations.map((a) => (a.id === id ? updated : a));
    editingId = null;
  }

  async function remove(id: string) {
    await chrome.runtime.sendMessage({ type: 'annotation/delete', payload: { id } });
    annotations = annotations.filter((a) => a.id !== id);
    onDelete(id);
  }
</script>

<div class="panel">
  <div class="header">
    <span class="title">Highlights ({annotations.length})</span>
    <button class="close-btn" onclick={onClose} aria-label="Schließen">✕</button>
  </div>

  <div class="list">
    {#if loading}
      <p class="empty">Lade…</p>
    {:else if annotations.length === 0}
      <p class="empty">Keine Highlights auf dieser Seite.</p>
    {:else}
      {#each sortedAnnotations as a (a.id)}
        <div class="item">
          <div
            class="item-quote"
            onclick={() => onEditNote(a.id)}
            onkeydown={(e) => e.key === 'Enter' && onEditNote(a.id)}
            role="button"
            tabindex="0"
          >
            "{a.quote.slice(0, 140)}{a.quote.length > 140 ? '…' : ''}"
          </div>

          {#if editingId === a.id}
            <textarea
              class="edit-input"
              bind:value={editNote}
              rows={3}
            ></textarea>
            <div class="item-actions">
              <button class="btn-small btn-primary" onclick={() => saveEdit(a.id)}>Speichern</button>
              <button class="btn-small" onclick={() => (editingId = null)}>Abbrechen</button>
            </div>
          {:else}
            {#if a.note}
              <p class="item-note">{a.note}</p>
            {/if}
            <div class="item-actions">
              <button class="btn-small" onclick={() => startEdit(a)}>Notiz bearbeiten</button>
              <button class="btn-small btn-danger" onclick={() => remove(a.id)}>Löschen</button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    z-index: 2147483647;
    background: #fff;
    border-left: 1px solid #e5e7eb;
    box-shadow: -4px 0 20px rgba(0,0,0,.12);
    display: flex;
    flex-direction: column;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #111827;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #6b7280;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .close-btn:hover { background: #f3f4f6; }
  .list {
    overflow-y: auto;
    flex: 1;
    padding: 8px 0;
  }
  .empty {
    padding: 16px;
    color: #9ca3af;
    text-align: center;
  }
  .item {
    padding: 10px 16px;
    border-bottom: 1px solid #f3f4f6;
  }
  .item-quote {
    margin: 0 0 6px;
    font-style: italic;
    color: #374151;
    border-left: 3px solid #fef08a;
    padding-left: 8px;
    cursor: pointer;
    line-height: 1.4;
    font-size: 12px;
  }
  .item-quote:hover { color: #6366f1; }
  .item-note {
    margin: 0 0 6px;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .edit-input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 5px 7px;
    font-size: 12px;
    font-family: inherit;
    resize: vertical;
    margin-bottom: 6px;
    outline: none;
  }
  .edit-input:focus { border-color: #6366f1; }
  .item-actions {
    display: flex;
    gap: 6px;
  }
  .btn-small {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    cursor: pointer;
    color: #374151;
  }
  .btn-small:hover { background: #f3f4f6; }
  .btn-primary {
    background: #6366f1;
    color: #fff;
    border-color: #6366f1;
  }
  .btn-primary:hover { background: #4f46e5; }
  .btn-danger {
    color: #dc2626;
    border-color: #fca5a5;
  }
  .btn-danger:hover { background: #fef2f2; }
</style>
