import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  DynamicBooleanSchema,
  ActionSchema,
  CheckableSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {Checkbox, Field, makeStyles, tokens} from '@fluentui/react-components';
import type {CheckboxOnChangeData} from '@fluentui/react-components';

// Extend the vendor CheckBoxApi with an optional action that fires on value change
const FlexibleCheckBoxApi = {
  name: 'CheckBox' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema,
    value: DynamicBooleanSchema,
    action: ActionSchema.optional(),
    checks: CheckableSchema.shape.checks,
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const CheckBox = createReactComponent(FlexibleCheckBoxApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
    props.setValue(!!data.checked);
    if (typeof props.action === 'function') {
      (props.action as () => void)();
    }
  };

  const hasError = props.validationErrors && props.validationErrors.length > 0;

  return (
    <div className={classes.root}>
      <Field
        validationMessage={hasError ? props.validationErrors?.[0] : undefined}
        validationState={hasError ? 'error' : 'none'}
      >
        <Checkbox
          checked={!!props.value}
          onChange={onChange}
          label={props.label || undefined}
        />
      </Field>
    </div>
  );
});
