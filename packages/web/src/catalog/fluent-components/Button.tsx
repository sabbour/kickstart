import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ButtonApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Button as FluentButton, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const Button = createReactComponent(ButtonApi, ({props, buildChild}) => {
  const classes = useStyles();

  const appearance =
    props.variant === 'primary'
      ? 'primary'
      : props.variant === 'borderless'
        ? 'transparent'
        : 'secondary';

  return (
    <FluentButton
      className={classes.root}
      appearance={appearance as 'primary' | 'transparent' | 'secondary'}
      onClick={props.action}
      disabled={props.isValid === false}
    >
      {props.child ? buildChild(props.child) : null}
    </FluentButton>
  );
});
