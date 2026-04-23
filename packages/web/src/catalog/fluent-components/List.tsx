import React from 'react';
import {z} from 'zod';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ChildListSchema} from '../../vendor/a2ui/web_core/schema/common-types';
import {makeStyles, tokens} from '@fluentui/react-components';
import {ChildList} from './ChildList';

// Flexible ListApi: children optional, non-strict (see Row.tsx + #984).
const FlexibleListApi = {
  name: 'List' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    children: ChildListSchema.optional(),
    direction: z.string().optional(),
    align: z.string().optional(),
  }),
};

const useStyles = makeStyles({
  horizontal: {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
    width: '100%',
    margin: '0',
    padding: '0',
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    overflowY: 'auto',
    width: '100%',
    margin: '0',
    padding: '0',
  },
});

const mapAlign = (a?: string) => {
  switch (a) {
    case 'start': return 'flex-start';
    case 'center': return 'center';
    case 'end': return 'flex-end';
    case 'stretch': return 'stretch';
    default: return 'stretch';
  }
};

export const List = createReactComponent(FlexibleListApi, ({props, buildChild, context}) => {
  const classes = useStyles();
  const isHorizontal = props.direction === 'horizontal';

  return (
    <div
      className={isHorizontal ? classes.horizontal : classes.vertical}
      style={{alignItems: mapAlign(props.align)}}
      role="list"
      aria-label={typeof props.accessibility?.label === 'string' ? props.accessibility.label : undefined}
    >
      <ChildList childList={props.children} buildChild={buildChild} context={context} />
    </div>
  );
});
