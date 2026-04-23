/**
 * Local Monaco worker configuration — avoids CDN dependency (jsdelivr).
 * Workers are bundled by Vite using `?worker` imports, eliminating
 * the supply-chain risk flagged by Zapp in the PR #115 review.
 *
 * monaco-editor and @monaco-editor/react are loaded dynamically so they
 * stay out of the main bundle until editable mode is first rendered.
 */
import type * as MonacoType from 'monaco-editor';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

declare global {
  interface Window {
    MonacoEnvironment?: MonacoType.Environment;
  }
}

let configured = false;

export async function ensureMonacoLocal(): Promise<void> {
  if (configured) return;
  configured = true;

  const [monaco, { loader }] = await Promise.all([
    import('monaco-editor'),
    import('@monaco-editor/react'),
  ]);

  self.MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') return new jsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };

  // Point @monaco-editor/react loader at the local bundle instead of CDN
  loader.config({ monaco });
}
