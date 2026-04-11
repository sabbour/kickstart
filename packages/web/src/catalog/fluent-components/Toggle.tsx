import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  DynamicBooleanSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {Switch, Field, makeStyles, tokens} from '@fluentui/react-components';

const FlexibleToggleApi = {
  name: 'Toggle' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema.optional(),
    checked: DynamicBooleanSchema.optional(),
    disabled: z.boolean().optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const Toggle = createReactComponent(FlexibleToggleApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: { checked: boolean }) => {
    props.setChecked(data.checked);
  };

  return (
    <div className={classes.root}>
      <Field>
        <Switch
          checked={!!props.checked}
          onChange={onChange}
          label={props.label || undefined}
          disabled={props.disabled === true}
        />
      </Field>
    </div>
  );
});
