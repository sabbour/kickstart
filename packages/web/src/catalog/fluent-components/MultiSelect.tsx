import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  DynamicStringListSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Combobox,
  Option,
  Field,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const FlexibleMultiSelectApi = {
  name: 'MultiSelect' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema.optional(),
    options: z.array(z.object({
      text: DynamicStringSchema,
      value: DynamicStringSchema,
    })),
    placeholder: DynamicStringSchema.optional(),
    value: DynamicStringListSchema.optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
});

export const MultiSelect = createReactComponent(FlexibleMultiSelectApi, ({props}) => {
  const classes = useStyles();
  const options = props.options ?? [];
  const selected = Array.isArray(props.value) ? props.value : [];

  const onOptionSelect = (_ev: any, data: { selectedOptions: string[] }) => {
    props.setValue(data.selectedOptions);
  };

  return (
    <div className={classes.root}>
      <Field label={props.label || undefined}>
        <Combobox
          placeholder={props.placeholder || undefined}
          multiselect
          selectedOptions={selected}
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
