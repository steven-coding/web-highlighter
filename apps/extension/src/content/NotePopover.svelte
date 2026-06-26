<script lang="ts">
  import { untrack } from 'svelte';
  import type { Annotation } from '@highlighter/core';

  let {
    annotation,
    x,
    y,
    onSave,
    onClose,
  }: {
    annotation: Annotation;
    x: number;
    y: number;
    onSave: (id: string, note: string) => void;
    onClose: () => void;
  } = $props();

  let note = $state(untrack(() => annotation.note));
  let saving = $state(false);

  async function save() {
    saving = true;
    onSave(annotation.id, note);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="popover"
  role="dialog"
  tabindex="-1"
  style="left:{x}px; top:{y}px;"
  onmousedown={(e) => e.stopPropagation()}
>
  <p class="quote">"{annotation.quote.slice(0, 120)}{annotation.quote.length > 120 ? '…' : ''}"</p>
  <textarea
    class="note-input"
    placeholder="Notiz hinzufügen…"
    rows={4}
    bind:value={note}
  ></textarea>
  <div class="actions">
    <button class="btn-save" onclick={save} disabled={saving}>Speichern</button>
    <button class="btn-cancel" onclick={onClose}>Schließen</button>
  </div>
</div>

<style>
  .popover {
    position: fixed;
    z-index: 2147483647;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,.15);
    padding: 12px;
    width: 280px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #111827;
  }
  .quote {
    margin: 0 0 8px;
    font-style: italic;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.4;
    border-left: 3px solid #fef08a;
    padding-left: 8px;
  }
  .note-input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    outline: none;
  }
  .note-input:focus {
    border-color: #6366f1;
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    justify-content: flex-end;
  }
  .btn-save {
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 12px;
  }
  .btn-save:hover { background: #4f46e5; }
  .btn-save:disabled { opacity: .6; cursor: default; }
  .btn-cancel {
    background: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 12px;
  }
  .btn-cancel:hover { background: #f9fafb; }
</style>
