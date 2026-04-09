import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';

const CodeBlockApi = {
  name: 'CodeBlock',
  schema: z.object({
    code: DynamicStringSchema,
    language: DynamicStringSchema.optional(),
    filename: DynamicStringSchema.optional(),
  }).strict(),
};

export const CodeBlock = createReactComponent(CodeBlockApi, ({ props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.code || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="kickstart-code-block" style={{ margin: '8px', width: '100%', boxSizing: 'border-box' }}>
      {(props.filename || props.language) && (
        <div className="kickstart-code-header">
          <div className="kickstart-code-filename">
            {props.filename && <span>{props.filename}</span>}
            {props.language && (
              <span className="kickstart-code-lang-badge">{props.language}</span>
            )}
          </div>
          <button
            className="kickstart-code-copy-btn"
            onClick={handleCopy}
            type="button"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      )}
      <pre className="kickstart-code-content">
        <code>{props.code}</code>
      </pre>
    </div>
  );
});
