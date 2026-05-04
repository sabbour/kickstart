import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  makeStyles, tokens,
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { ArrowDownloadRegular, CheckmarkRegular, CopyRegular } from '@fluentui/react-icons';
import { useDebug } from '../../contexts/DebugContext';
import type { ChatMessage, ActionDebugEvent } from '../../types';

// ---------------------------------------------------------------------------
// Trace assembly
// ---------------------------------------------------------------------------

export interface ConversationTrace {
  exportedAt: string;
  sessionId: string | undefined;
  turns: ChatMessage[];
  actionLog: ActionDebugEvent[];
}

export function buildConversationTrace(
  messages: ChatMessage[],
  actionLog: ActionDebugEvent[],
  sessionId: string | undefined,
): ConversationTrace {
  return {
    exportedAt: new Date().toISOString(),
    sessionId,
    turns: messages,
    actionLog,
  };
}

function traceFilename(sessionId: string | undefined): string {
  const date = new Date().toISOString().slice(0, 10);
  const sid = sessionId ? `-${sessionId}` : '';
  return `trace${sid}-${date}.json`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    marginTop: tokens.spacingVerticalS,
  },
  label: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    flexGrow: 1,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DebugTraceExportProps {
  messages: ChatMessage[];
  sessionId: string | undefined;
}

export function DebugTraceExport({ messages, sessionId }: DebugTraceExportProps) {
  const { actionLog } = useDebug();
  const [copied, setCopied] = useState(false);
  const styles = useStyles();
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const buildTrace = useCallback((): string => {
    const trace = buildConversationTrace(messages, actionLog, sessionId);
    return JSON.stringify(trace, null, 2);
  }, [messages, actionLog, sessionId]);

  const handleDownload = useCallback(() => {
    const json = buildTrace();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = traceFilename(sessionId);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildTrace, sessionId]);

  const handleCopy = useCallback(async () => {
    const json = buildTrace();

    const markCopied = () => {
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(json);
        markCopied();
        return;
      } catch {
        // fall through to execCommand fallback
      }
    }

    // Fallback for browsers without navigator.clipboard
    try {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) markCopied();
    } catch {
      // Clipboard unavailable — user can use Download instead.
    }
  }, [buildTrace]);

  if (messages.length === 0) return null;

  return (
    <div className={styles.container} data-testid="debug-trace-export">
      <span className={styles.label}>
        {`Trace: ${messages.length} turn${messages.length !== 1 ? 's' : ''}`}
        {actionLog.length > 0 ? `, ${actionLog.length} action${actionLog.length !== 1 ? 's' : ''}` : ''}
      </span>

      <Tooltip content="Download full conversation trace as JSON" relationship="label">
        <Button
          size="small"
          appearance="secondary"
          icon={<ArrowDownloadRegular />}
          onClick={handleDownload}
        >
          Download trace
        </Button>
      </Tooltip>

      <Tooltip content={copied ? 'Copied!' : 'Copy full conversation trace to clipboard'} relationship="label">
        <Button
          size="small"
          appearance="secondary"
          icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy trace'}
        </Button>
      </Tooltip>
    </div>
  );
}
