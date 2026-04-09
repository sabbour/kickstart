import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ColumnApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {makeStyles, tokens} from '@fluentui/react-components';
import {ChildList} from './ChildList';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    width: '100%',
    margin: '0',
    padding: '0',
  },
});

const mapJustify = (j?: string) => {
  switch (j) {
    case 'center': return 'center';
    case 'end': return 'flex-end';
    case 'spaceAround': return 'space-around';
    case 'spaceBetween': return 'space-between';
    case 'spaceEvenly': return 'space-evenly';
    case 'start': return 'flex-start';
    case 'stretch': return 'stretch';
    default: return 'flex-start';
  }
};

const mapAlign = (a?: string) => {
  switch (a) {
    case 'start': return 'flex-start';
    case 'center': return 'center';
    case 'end': return 'flex-end';
    case 'stretch': return 'stretch';
    default: return 'stretch';
  }
};

export const Column = createReactComponent(ColumnApi, ({props, buildChild, context}) => {
  const classes = useStyles();

  return (
    <div
      className={classes.root}
      style={{
        justifyContent: mapJustify(props.justify),
        alignItems: mapAlign(props.align),
      }}
    >
      <ChildList childList={props.children} buildChild={buildChild} context={context} />
    </div>
  );
});
