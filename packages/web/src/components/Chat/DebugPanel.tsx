import React, { useState } from 'react';
import {
  makeStyles, tokens,
  Text,
} from '@fluentui/react-components';
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
  sectionLabel: {
    display: 'block',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase200,
  },
  codeBlock: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '200px',
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
  decisionList: {
    listStyleType: 'disc',
    paddingLeft: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalXXS,
    marginBottom: '0',
  },
  decisionItem: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXXS,
  },
  notAvailable: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
  },
});

export function DebugPanel({ debugInfo }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = useStyles();
  const { resolvedTheme } = useTheme();

  const codeBlockClass = `${styles.codeBlock} ${resolvedTheme === 'dark' ? styles.codeBlockDark : styles.codeBlockLight}`;

  return (
    <div className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        aria-label="Toggle debug panel"
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>Debug</span>
      </button>

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

          {/* Raw LLM Response */}
          <div className={styles.section}>
            <Text className={styles.sectionLabel}>Raw LLM Response</Text>
            {debugInfo?.rawResponse ? (
              <code className={codeBlockClass}>
                {debugInfo.rawResponse}
              </code>
            ) : (
              <Text className={styles.notAvailable} size={200}>Not available</Text>
            )}
          </div>

          {/* Render Decisions */}
          <div className={styles.section}>
            <Text className={styles.sectionLabel}>Render Decisions</Text>
            {debugInfo?.renderDecisions && debugInfo.renderDecisions.length > 0 ? (
              <ul className={styles.decisionList}>
                {debugInfo.renderDecisions.map((decision, i) => (
                  <li key={i} className={styles.decisionItem}>{decision}</li>
                ))}
              </ul>
            ) : (
              <Text className={styles.notAvailable} size={200}>Not available</Text>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
