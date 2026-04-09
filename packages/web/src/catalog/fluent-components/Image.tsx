import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ImageApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Image as FluentImage, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    display: 'block',
    width: '100%',
    height: 'auto',
  },
  icon: {
    width: '24px',
    height: '24px',
  },
  avatar: {
    width: '40px',
    height: '40px',
  },
  smallFeature: {
    maxWidth: '100px',
  },
  largeFeature: {
    maxHeight: '400px',
  },
  header: {
    height: '200px',
  },
});

export const Image = createReactComponent(ImageApi, ({props}) => {
  const classes = useStyles();

  const mapFit = (fit?: string): 'none' | 'center' | 'contain' | 'cover' | 'default' => {
    if (fit === 'scaleDown') return 'none';
    if (fit === 'contain') return 'contain';
    if (fit === 'cover') return 'cover';
    if (fit === 'none') return 'none';
    return 'default';
  };

  let className = classes.root;
  let shape: 'square' | 'circular' | 'rounded' | undefined;

  if (props.variant === 'icon') {
    className = `${classes.root} ${classes.icon}`;
  } else if (props.variant === 'avatar') {
    className = `${classes.root} ${classes.avatar}`;
    shape = 'circular';
  } else if (props.variant === 'smallFeature') {
    className = `${classes.root} ${classes.smallFeature}`;
  } else if (props.variant === 'largeFeature') {
    className = `${classes.root} ${classes.largeFeature}`;
  } else if (props.variant === 'header') {
    className = `${classes.root} ${classes.header}`;
  }

  return (
    <FluentImage
      className={className}
      src={props.url}
      alt={props.description || ''}
      fit={mapFit(props.fit)}
      shape={shape}
    />
  );
});
