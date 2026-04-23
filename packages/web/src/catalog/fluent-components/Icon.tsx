import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {IconApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Body1, makeStyles, tokens} from '@fluentui/react-components';
import { getFluentIcon } from '../icons/fluent-icons';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground1,
  },
  img: {
    width: '24px',
    height: '24px',
    objectFit: 'contain' as const,
  },
  text: {
    fontSize: tokens.fontSizeBase500,
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const Icon = createReactComponent(IconApi, ({props}) => {
  const classes = useStyles();
  const iconName =
    typeof props.name === 'string' ? props.name : (props.name as {path?: string})?.path;
  const a11yLabel = typeof props.accessibility?.label === 'string' ? props.accessibility.label : undefined;
  const isDecorative = !a11yLabel;

  if (!iconName) {
    return <Body1>?</Body1>;
  }

  // Fluent UI React icons — look up by name in registry
  const FluentIcon = getFluentIcon(iconName);
  if (FluentIcon) {
    return (
      <span className={classes.root} aria-hidden={isDecorative} aria-label={a11yLabel || undefined} role={a11yLabel ? 'img' : undefined}>
        <FluentIcon fontSize={24} />
      </span>
    );
  }

  // SVG path-based icons (from /assets/icons/...)
  if (iconName.startsWith('/')) {
    return (
      <span className={classes.root} aria-hidden={isDecorative} aria-label={a11yLabel || undefined} role={a11yLabel ? 'img' : undefined}>
        <img src={iconName} alt={a11yLabel || iconName.split('/').pop() || 'icon'} className={classes.img} />
      </span>
    );
  }

  // Text-based fallback (Material Symbols via CSS class, or plain text)
  return (
    <span className={`${classes.root} ${classes.text}`} aria-hidden={isDecorative} aria-label={a11yLabel || undefined} role={a11yLabel ? 'img' : undefined}>
      {iconName}
    </span>
  );
});
