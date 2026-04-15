import React from 'react';
import {
  CheckmarkCircle20Filled,
  Warning20Filled,
  DismissCircle20Filled,
  Info20Filled,
} from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-components';

const emojiIconMap: Record<string, { icon: React.FC<{ style?: React.CSSProperties }>; color: string }> = {
  '✅': { icon: CheckmarkCircle20Filled, color: tokens.colorPaletteGreenForeground1 },
  '⚠️': { icon: Warning20Filled, color: tokens.colorPaletteDarkOrangeForeground1 },
  '⚠': { icon: Warning20Filled, color: tokens.colorPaletteDarkOrangeForeground1 },
  '❌': { icon: DismissCircle20Filled, color: tokens.colorPaletteRedForeground1 },
  'ℹ️': { icon: Info20Filled, color: tokens.colorPaletteBlueForeground2 },
  'ℹ': { icon: Info20Filled, color: tokens.colorPaletteBlueForeground2 },
};

// Sorted longest-first so multi-codepoint emoji variants (⚠️, ℹ️) match before single-codepoint forms
const sortedEmoji = Object.keys(emojiIconMap).sort((a, b) => b.length - a.length);

/**
 * Replaces a leading emoji status indicator in a text string with the
 * corresponding Fluent UI icon component. Returns the original string
 * unchanged if no known emoji prefix is found.
 */
export function replaceStatusEmoji(text: string): React.ReactNode {
  for (const emoji of sortedEmoji) {
    if (text.startsWith(emoji)) {
      const rest = text.slice(emoji.length).trimStart();
      const { icon: Icon, color } = emojiIconMap[emoji];
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Icon style={{ color, flexShrink: 0 }} />
          {rest}
        </span>
      );
    }
  }
  return text;
}
