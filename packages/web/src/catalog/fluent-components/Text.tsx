import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {TextApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {
  Title1,
  Title2,
  Title3,
  Subtitle1,
  Subtitle2,
  Caption1,
  Body1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
    display: 'inline-block',
  },
});

// Parse basic inline markdown: **bold** and *italic*
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** first, then *italic* (order matters)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export const Text = createReactComponent(TextApi, ({props}) => {
  const classes = useStyles();
  const raw = props.text ?? '';
  const content = parseInlineMarkdown(raw);

  switch (props.variant) {
    case 'h1':
      return <Title1 className={classes.root} block>{content}</Title1>;
    case 'h2':
      return <Title2 className={classes.root} block>{content}</Title2>;
    case 'h3':
      return <Title3 className={classes.root} block>{content}</Title3>;
    case 'h4':
    case 'subtitle1':
      return <Subtitle1 className={classes.root} block>{content}</Subtitle1>;
    case 'h5':
    case 'subtitle2':
      return <Subtitle2 className={classes.root} block>{content}</Subtitle2>;
    case 'caption':
      return <Caption1 className={classes.root}>{content}</Caption1>;
    case 'body':
    case 'body1':
    case 'body2':
    default:
      return <Body1 className={classes.root}>{content}</Body1>;
  }
});
