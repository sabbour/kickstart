import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {IconApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Body1, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    fontSize: '24px',
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground1,
  },
});

export const Icon = createReactComponent(IconApi, ({props}) => {
  const classes = useStyles();
  const iconName =
    typeof props.name === 'string' ? props.name : (props.name as {path?: string})?.path;

  if (!iconName) {
    return <Body1>?</Body1>;
  }

  return (
    <span className={`material-symbols-outlined ${classes.root}`}>
      {iconName}
    </span>
  );
});
