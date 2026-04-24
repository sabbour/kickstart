import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ImageApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Image as FluentImage, makeStyles, mergeClasses, tokens} from '@fluentui/react-components';

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
    className = mergeClasses(classes.root, classes.icon);
  } else if (props.variant === 'avatar') {
    className = mergeClasses(classes.root, classes.avatar);
    shape = 'circular';
  } else if (props.variant === 'smallFeature') {
    className = mergeClasses(classes.root, classes.smallFeature);
  } else if (props.variant === 'largeFeature') {
    className = mergeClasses(classes.root, classes.largeFeature);
  } else if (props.variant === 'header') {
    className = mergeClasses(classes.root, classes.header);
  }

  return (
    <FluentImage
      className={className}
      src={props.url}
      alt={typeof props.accessibility?.label === 'string' ? props.accessibility.label : (typeof props.description === 'string' ? props.description : '')}
      fit={mapFit(props.fit)}
      shape={shape}
    />
  );
});
