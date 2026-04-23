import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {DynamicStringSchema} from '../../vendor/a2ui/schema/common-types';
import {
  Link as FluentLink,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {OpenRegular} from '@fluentui/react-icons';

const FlexibleLinkApi = {
  name: 'Link' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    text: DynamicStringSchema,
    url: DynamicStringSchema,
    external: z.boolean().optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalXXS,
  },
  icon: {
    marginLeft: tokens.spacingHorizontalXXS,
    fontSize: '12px',
    verticalAlign: 'middle',
  },
});

export const Link = createReactComponent(FlexibleLinkApi, ({props}) => {
  const classes = useStyles();
  const isExternal = props.external === true;

  return (
    <FluentLink
      className={classes.root}
      href={props.url ?? '#'}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      inline
    >
      {props.text ?? ''}
      {isExternal && (
        <>
          <OpenRegular className={classes.icon} aria-hidden="true" />
          <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            (opens in new window)
          </span>
        </>
      )}
    </FluentLink>
  );
});
