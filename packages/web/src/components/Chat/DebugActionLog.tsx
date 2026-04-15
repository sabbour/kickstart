import React, { useState } from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { useDebug } from '../../contexts/DebugContext';

const useStyles = makeStyles({
  container: {
    marginTop: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground1,
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
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: '0',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
  },
  event: {
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  timestamp: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase100,
  },
  actionName: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  category: {
    display: 'inline-block',
    paddingLeft: tokens.spacingHorizontalXXS,
    paddingRight: tokens.spacingHorizontalXXS,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase100,
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground2,
  },
  label: {
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  code: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
});

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function DebugActionLog() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { actionLog } = useDebug();
  const styles = useStyles();

  if (actionLog.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} data-testid="chat-debug-action-log">
      <button
        className={styles.toggle}
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        aria-label="Toggle action timeline"
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>{`Action timeline (${actionLog.length})`}</span>
      </button>

      {isExpanded && (
        <div className={styles.list}>
          {actionLog.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className={styles.event}>
              <div className={styles.header}>
                <span className={styles.timestamp}>{formatTime(event.timestamp)}</span>
                <span className={styles.actionName}>{event.actionName}</span>
                <span className={styles.category}>{event.category}</span>
              </div>

              <Text className={styles.label} size={200}>Outbound message</Text>
              <code className={styles.code}>{event.outboundMessage}</code>

              <Text className={styles.label} size={200}>Context</Text>
              <code className={styles.code}>{JSON.stringify(event.context, null, 2)}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
