import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {CardApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Card as FluentCard, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
});

export const Card = createReactComponent(CardApi, ({props, buildChild}) => {
  const classes = useStyles();

  return (
    <FluentCard className={classes.root}>
      {props.child ? buildChild(props.child) : null}
    </FluentCard>
  );
});
