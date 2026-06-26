// Ensure the SW activates immediately without waiting for old clients
self.addEventListener('install', () => (self as unknown as ServiceWorkerGlobalScope).skipWaiting());
self.addEventListener('activate', (e) =>
  (e as ExtendableEvent).waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim()),
);

import type { ExtMsg, MsgPayloads } from '@highlighter/core';
import { createAnnotation, updateAnnotation, deleteAnnotation, listAnnotationsByUrl } from './db.js';
import { exportMarkdown } from './export.js';

chrome.runtime.onMessage.addListener(
  (message: ExtMsg, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        console.error('[wh-bg]', err);
        sendResponse({ error: String(err) });
      });
    return true;
  },
);

async function handle(msg: ExtMsg): Promise<unknown> {
  switch (msg.type) {
    case 'annotation/create':
      return createAnnotation(msg.payload as MsgPayloads['annotation/create'][0]);

    case 'annotation/update': {
      const { id, note } = msg.payload as MsgPayloads['annotation/update'][0];
      return updateAnnotation(id, note);
    }

    case 'annotation/delete': {
      const { id } = msg.payload as MsgPayloads['annotation/delete'][0];
      await deleteAnnotation(id);
      return { ok: true };
    }

    case 'annotation/listByUrl': {
      const { url } = msg.payload as MsgPayloads['annotation/listByUrl'][0];
      return listAnnotationsByUrl(url);
    }

    case 'export/markdown': {
      const { url } = msg.payload as MsgPayloads['export/markdown'][0];
      const { filename, markdown } = await exportMarkdown(url);
      const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
      await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
      return { filename, markdown };
    }

    default:
      throw new Error(`Unknown message type: ${String((msg as ExtMsg).type)}`);
  }
}
