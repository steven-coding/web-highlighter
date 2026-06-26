import { mount, unmount } from 'svelte';
import type { Annotation } from '@highlighter/core';
import { normalizeUrl } from '@highlighter/core';
import {
  describeSelection,
  anchorAnnotation,
  applyHighlightToRange,
  HIGHLIGHT_ATTR,
  DEFAULT_COLOR,
  type SelectionData,
} from './anchor.js';
// SelectionData is used in onFloatBtnClick
import NotePopover from './NotePopover.svelte';
import LibraryPanel from './LibraryPanel.svelte';

const pageUrl = normalizeUrl(location.href);

// Stores cleanup functions (remove highlight) per annotation id
const cleanups = new Map<string, () => void>();

// Local annotation count — updated on create/delete/reanchor so popup doesn't need a BG call
let localCount = 0;

// Pending Range captured immediately on mouseup (before selection can change)
let pendingRange: Range | null = null;

// Mounted component instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let noteInstance: Record<string, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let libraryInstance: Record<string, any> | null = null;

// Floating button element
let floatBtn: HTMLElement | null = null;

// ─── Bootstrap ─────────────────────────────────────────────────────────────

// Listeners must be registered synchronously — don't wait for reanchorAll
setupSelectionListener();
setupClickDelegation();
setupMessageListener();
reanchorAll().catch((err) => console.error('[wh] reanchor failed', err));

// ─── Re-anchoring (M3) ────────────────────────────────────────────────────

async function reanchorAll() {
  let annotations: Annotation[];
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'annotation/listByUrl',
      payload: { url: pageUrl },
    });
    annotations = Array.isArray(res) ? res : [];
  } catch (err) {
    console.error('[wh] reanchorAll: background not reachable', err);
    return;
  }
  for (const a of annotations) {
    const cleanup = await anchorAnnotation(a);
    if (cleanup) cleanups.set(a.id, cleanup);
  }
  localCount = cleanups.size;
}

// ─── Selection → floating button (M2) ─────────────────────────────────────

function setupSelectionListener() {
  document.addEventListener('mouseup', (e) => {
    const target = e.target as Element | null;
    if (target?.closest?.('[data-wh-ui]')) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      removeFloatBtn();
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed || !range.toString().trim()) {
      removeFloatBtn();
      return;
    }

    // Clone immediately — selection is still valid right here
    pendingRange = range.cloneRange();

    const rect = range.getBoundingClientRect();
    showFloatBtn(
      rect.left + rect.width / 2 + window.scrollX,
      rect.top + window.scrollY - 8,
    );
  });

  // Dismiss button when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    const target = e.target as Element | null;
    if (target?.closest?.('[data-wh-ui]')) return;
    if (target?.closest?.(`mark[${HIGHLIGHT_ATTR}]`)) return;
    removeFloatBtn();
  });
}

function showFloatBtn(x: number, y: number) {
  removeFloatBtn();
  const btn = document.createElement('button');
  btn.setAttribute('data-wh-ui', '');
  btn.textContent = '✏ Highlight';
  Object.assign(btn.style, {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: '2147483647',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,.2)',
    fontFamily: 'system-ui, sans-serif',
    userSelect: 'none',
  });
  btn.addEventListener('click', onFloatBtnClick);
  document.body.appendChild(btn);
  floatBtn = btn;
}

function removeFloatBtn() {
  floatBtn?.remove();
  floatBtn = null;
}

async function onFloatBtnClick() {
  if (!pendingRange) return;
  const range = pendingRange;
  pendingRange = null;
  removeFloatBtn();

  // describeTextQuote runs here (async, after button click) — range is still valid
  let selData: SelectionData;
  try {
    selData = await describeSelection(range);
  } catch (err) {
    console.error('[wh] describeSelection failed — using raw text fallback', err);
    selData = { quote: range.toString(), prefix: '', suffix: '', textPosition: undefined, range };
  }

  let annotation: Annotation;
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'annotation/create',
      payload: {
        url: pageUrl,
        pageTitle: document.title,
        quote: selData.quote,
        prefix: selData.prefix,
        suffix: selData.suffix,
        textPosition: selData.textPosition,
        note: '',
        tags: [],
        color: DEFAULT_COLOR,
      },
    });
    if (!res || res.error) throw new Error(res?.error ?? 'No response from background');
    annotation = res as Annotation;
  } catch (err) {
    console.error('[wh] annotation/create failed', err);
    return;
  }

  const cleanup = applyHighlightToRange(annotation.id, annotation.color, selData.range);
  cleanups.set(annotation.id, cleanup);
  localCount++;

  openNotePopover(annotation);
}

// ─── Click on existing highlight → note popover (M4) ──────────────────────

function setupClickDelegation() {
  document.addEventListener('click', (e) => {
    const mark = (e.target as Element).closest(`mark[${HIGHLIGHT_ATTR}]`);
    if (!mark) return;
    const id = mark.getAttribute(HIGHLIGHT_ATTR);
    if (!id) return;
    fetchAnnotationAndOpenPopover(id, e.clientX, e.clientY);
  });
}

async function fetchAnnotationAndOpenPopover(id: string, cx: number, cy: number) {
  const annotations: Annotation[] = await chrome.runtime.sendMessage({
    type: 'annotation/listByUrl',
    payload: { url: pageUrl },
  });
  const a = annotations.find((ann) => ann.id === id);
  if (a) openNotePopover(a, cx, cy);
}

// ─── Note Popover (M4) ────────────────────────────────────────────────────

function openNotePopover(annotation: Annotation, clientX?: number, clientY?: number) {
  closeNotePopover();

  const x = clientX ?? window.innerWidth / 2 - 140;
  const y = clientY ?? window.innerHeight / 2 - 100;

  const container = document.createElement('div');
  container.setAttribute('data-wh-ui', '');
  document.body.appendChild(container);

  noteInstance = mount(NotePopover, {
    target: container,
    props: {
      annotation,
      x: Math.min(x, window.innerWidth - 300),
      y: Math.max(y - 200, 10),
      onSave: async (id: string, note: string) => {
        await chrome.runtime.sendMessage({
          type: 'annotation/update',
          payload: { id, note },
        });
        closeNotePopover();
      },
      onClose: closeNotePopover,
    },
  });

  // Tag the container for later cleanup
  (noteInstance as unknown as { _container: HTMLElement })._container = container;
}

function closeNotePopover() {
  if (noteInstance) {
    unmount(noteInstance);
    const c = (noteInstance as unknown as { _container?: HTMLElement })._container;
    c?.remove();
    noteInstance = null;
  }
}

// ─── Library Panel (M5) ───────────────────────────────────────────────────

function openLibrary() {
  if (libraryInstance) {
    closeLibrary();
    return;
  }
  const container = document.createElement('div');
  container.setAttribute('data-wh-ui', '');
  document.body.appendChild(container);

  libraryInstance = mount(LibraryPanel, {
    target: container,
    props: {
      url: pageUrl,
      onClose: closeLibrary,
      onDelete: (id: string) => {
        const cleanup = cleanups.get(id);
        cleanup?.();
        cleanups.delete(id);
        localCount = Math.max(0, localCount - 1);
      },
      onScrollTo: (id: string) => {
        const mark = document.querySelector(`mark[${HIGHLIGHT_ATTR}="${id}"]`);
        mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
  });

  (libraryInstance as unknown as { _container: HTMLElement })._container = container;
}

function closeLibrary() {
  if (libraryInstance) {
    unmount(libraryInstance);
    const c = (libraryInstance as unknown as { _container?: HTMLElement })._container;
    c?.remove();
    libraryInstance = null;
  }
}

// ─── Messages from popup (M5, M6) ─────────────────────────────────────────

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'library/toggle') {
      openLibrary();
      sendResponse({ ok: true });
    } else if (msg.type === 'page/info') {
      // Return local count synchronously — no background call needed
      sendResponse({ url: pageUrl, count: localCount });
    }
  });
}
