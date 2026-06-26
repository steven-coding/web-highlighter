import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Web Highlighter',
  version: '0.0.1',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Web Highlighter',
  },
  background: {
    service_worker: 'src/background/worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
    },
  ],
  // host_permissions needed so content script re-anchors on every page load (M3)
  host_permissions: ['<all_urls>'],
  permissions: ['activeTab', 'scripting', 'downloads'],
});
