import React from 'react';
export function PreviewPanel() {
    return (<aside className="file-viewer hidden" aria-label="Preview panel">
      <div className="preview-panel-header">
        <span className="preview-panel-title">Preview</span>
        <button className="preview-panel-close" aria-label="Close preview" title="Close">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.09 4.22a.5.5 0 01.63-.06l.07.06L10 9.44l5.22-5.22a.5.5 0 01.63-.06l.07.06a.5.5 0 01.06.63l-.06.07L10.7 10.1l5.22 5.22a.5.5 0 01-.63.76l-.07-.06L10 10.8l-5.22 5.22a.5.5 0 01-.63.06l-.07-.06a.5.5 0 01-.06-.63l.06-.07 5.22-5.22-5.22-5.22a.5.5 0 01-.06-.63l.06-.07z"/>
          </svg>
        </button>
      </div>
      <div className="preview-panel-body hidden"/>
    </aside>);
}
//# sourceMappingURL=PreviewPanel.js.map