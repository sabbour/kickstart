import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {DynamicStringSchema, ActionSchema} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Combobox,
  Option,
  Field,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const FlexibleComboBoxApi = {
  name: 'ComboBox' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema.optional(),
    options: z.array(z.object({
      text: DynamicStringSchema,
      value: DynamicStringSchema,
    })),
    placeholder: DynamicStringSchema.optional(),
    allowCustom: z.boolean().optional(),
    value: DynamicStringSchema.optional(),
    action: ActionSchema.optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
});

export const ComboBox = createReactComponent(FlexibleComboBoxApi, ({props}) => {
  const classes = useStyles();
  const options = props.options ?? [];

  const onOptionSelect = (_ev: any, data: { optionValue?: string }) => {
    if (props.setValue && data.optionValue) {
      props.setValue(data.optionValue);
    }
    if (typeof props.action === 'function') {
      (props.action as () => void)();
    }
  };

  return (
    <div className={classes.root}>
      <Field label={props.label || undefined}>
        <Combobox
          placeholder={props.placeholder || undefined}
          freeform={props.allowCustom === true}
          value={props.value ?? ''}
          onOptionSelect={onOptionSelect}
        >
          {options.map((opt: any, i: number) => (
            <Option key={i} value={opt.value ?? ''}>
              {opt.text ?? opt.value ?? ''}
            </Option>
          ))}
        </Combobox>
      </Field>
    </div>
  );
});
