/**
 * Ambient type declarations for build-time asset imports used by the rich
 * components. Vite resolves these at bundle time; TypeScript just needs a
 * module shape so the imports don't error.
 */

// highlight.js bundled CSS themes — imported for side effects
declare module 'highlight.js/styles/*.css';

// Monaco worker ?worker imports — Vite rewrites these to Worker constructors.
// Typed as a Worker constructor so `new editorWorker()` type-checks.
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
