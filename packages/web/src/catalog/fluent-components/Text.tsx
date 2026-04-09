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
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    display: 'inline-block',
  },
});

export const Text = createReactComponent(TextApi, ({props}) => {
  const classes = useStyles();
  const text = props.text ?? '';

  switch (props.variant) {
    case 'h1':
      return <Title1 className={classes.root} block>{text}</Title1>;
    case 'h2':
      return <Title2 className={classes.root} block>{text}</Title2>;
    case 'h3':
      return <Title3 className={classes.root} block>{text}</Title3>;
    case 'h4':
      return <Subtitle1 className={classes.root} block>{text}</Subtitle1>;
    case 'h5':
      return <Subtitle2 className={classes.root} block>{text}</Subtitle2>;
    case 'caption':
      return <Caption1 className={classes.root}>{text}</Caption1>;
    case 'body':
    default:
      return <Body1 className={classes.root}>{text}</Body1>;
  }
});
