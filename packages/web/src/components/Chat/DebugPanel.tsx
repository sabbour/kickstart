import React, { useState } from 'react';
import {
  makeStyles, tokens,
  Button,
  Text,
} from '@fluentui/react-components';
import { CheckmarkRegular, CopyRegular } from '@fluentui/react-icons';
import { useTheme } from '../../contexts/ThemeContext';
import type { DebugMetadata } from '../../types';

interface DebugPanelProps {
  debugInfo?: DebugMetadata;
}

const useStyles = makeStyles({
  container: {
    marginTop: tokens.spacingVerticalXS,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    paddingTop: tokens.spacingVerticalXS,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground2,
    },
  },
  panel: {
    marginTop: tokens.spacingVerticalXS,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  section: {
    marginBottom: tokens.spacingVerticalS,
  },
  sectionToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightSemibold as any,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  sectionLabel: {
    display: 'block',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase200,
  },
  sectionActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: tokens.spacingVerticalXS,
  },
  codeBlock: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '300px',
    overflowY: 'auto',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
  },
  codeBlockLight: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  codeBlockDark: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  jsonKey: {
    color: tokens.colorPaletteBlueBorderActive,
  },
  jsonString: {
    color: tokens.colorPaletteGreenForeground1,
  },
  jsonNumber: {
    color: tokens.colorPaletteMarigoldForeground1,
  },
  jsonBoolean: {
    color: tokens.colorPaletteMarigoldForeground1,
  },
  jsonNull: {
    color: tokens.colorNeutralForeground4,
  },
  notAvailable: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
  },
});

/** Simple JSON syntax highlighting via inline styles. */
function highlightJson(json: string, styles: ReturnType<typeof useStyles>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex matches JSON keys, string values, numbers, booleans, null
  const re = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|((?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=[,\s\]}]))|(\btrue\b|\bfalse\b)|(\bnull\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(json)) !== null) {
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Key
      parts.push(<span key={key++} className={styles.jsonKey}>{match[1]}</span>);
    } else if (match[2]) {
      // String value
      parts.push(<span key={key++} className={styles.jsonString}>{match[2]}</span>);
    } else if (match[3]) {
      // Number
      parts.push(<span key={key++} className={styles.jsonNumber}>{match[3]}</span>);
    } else if (match[4]) {
      // Boolean
      parts.push(<span key={key++} className={styles.jsonBoolean}>{match[4]}</span>);
    } else if (match[5]) {
      // Null
      parts.push(<span key={key++} className={styles.jsonNull}>{match[5]}</span>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < json.length) {
    parts.push(json.slice(lastIndex));
  }
  return parts;
}

/** Collapsible section wrapper. */
function CollapsibleSection({ label, defaultOpen = false, children, styles: s }: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  styles: ReturnType<typeof useStyles>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.section}>
      <button
        className={s.sectionToggle}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-label={`Toggle ${label}`}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>
      {open && children}
    </div>
  );
}

export function DebugPanel({ debugInfo }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const styles = useStyles();
  const { resolvedTheme } = useTheme();

  const codeBlockClass = `${styles.codeBlock} ${resolvedTheme === 'dark' ? styles.codeBlockDark : styles.codeBlockLight}`;
  const copyPayload = getCopyPayload(debugInfo);

  const handleCopy = async () => {
    if (!copyPayload) {
      return;
    }

    if (!navigator.clipboard) {
      // eslint-disable-next-line no-console
      console.warn('[DebugPanel] Clipboard API unavailable while copying LLM response.');
      return;
    }

    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[DebugPanel] Failed to copy LLM response.', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.toggle}
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-label="Toggle debug panel"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>Debug</span>
        </button>
        {copyPayload && (
          <Button
            size="small"
            appearance="secondary"
            icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy response'}
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className={styles.panel}>
          {/* Model */}
          <div className={styles.section}>
            <Text className={styles.sectionLabel}>Model</Text>
            {debugInfo?.model ? (
              <Text font="monospace" size={200}>{debugInfo.model}</Text>
            ) : (
              <Text className={styles.notAvailable} size={200}>Not available</Text>
            )}
          </div>

          {/* Full LLM Response Envelope */}
          <CollapsibleSection label="Full LLM Response (JSON)" defaultOpen={true} styles={styles}>
            {debugInfo?.fullEnvelope ? (
              <code className={codeBlockClass}>
                {highlightJson(JSON.stringify(debugInfo.fullEnvelope, null, 2), styles)}
              </code>
            ) : (debugInfo?.rawContent ?? debugInfo?.rawResponse) ? (
              <code className={codeBlockClass}>
                {tryPrettyPrint(debugInfo?.rawContent ?? debugInfo?.rawResponse ?? '', styles)}
              </code>
            ) : (
              <Text className={styles.notAvailable} size={200}>Not available</Text>
            )}
          </CollapsibleSection>

        </div>
      )}
    </div>
  );
}

function getCopyPayload(debugInfo?: DebugMetadata): string | null {
  if (!debugInfo) {
    return null;
  }

  if (debugInfo.fullEnvelope) {
    return JSON.stringify(debugInfo.fullEnvelope, null, 2);
  }

  const rawPayload = debugInfo.rawContent ?? debugInfo.rawResponse;
  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(rawPayload), null, 2);
  } catch {
    return rawPayload;
  }
}

/** Try to parse as JSON and pretty-print; fall back to raw text with highlighting attempt. */
function tryPrettyPrint(text: string, styles: ReturnType<typeof useStyles>): React.ReactNode {
  try {
    const parsed = JSON.parse(text);
    return highlightJson(JSON.stringify(parsed, null, 2), styles);
  } catch {
    return text;
  }
}
