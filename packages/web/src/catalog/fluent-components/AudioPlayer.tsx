import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {AudioPlayerApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Caption1, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    width: '100%',
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  audio: {
    width: '100%',
  },
});

export const AudioPlayer = createReactComponent(AudioPlayerApi, ({props}) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      {props.description && (
        <Caption1>{props.description}</Caption1>
      )}
      <audio src={props.url} controls className={classes.audio} />
    </div>
  );
});
