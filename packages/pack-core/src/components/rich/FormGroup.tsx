import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ComponentIdSchema,
} from '../../vendor/a2ui/schema/common-types';
import {
  Card,
  CardHeader,
  Badge,
  Subtitle1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const FormGroupApi = {
  name: 'FormGroup',
  schema: z.object({
    title: DynamicStringSchema,
    step: z.number().optional(),
    child: ComponentIdSchema,
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: tokens.spacingHorizontalL,
  },
});

export const FormGroup = createReactComponent(FormGroupApi, ({ props, buildChild }) => {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Subtitle1>{props.title}</Subtitle1>}
        action={
          props.step != null ? (
            <Badge appearance="filled" color="informative">Step {props.step}</Badge>
          ) : undefined
        }
      />
      <div>
        {props.child ? buildChild(props.child) : null}
      </div>
    </Card>
  );
});
