import React, {useState} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  DynamicStringListSchema,
  ActionSchema,
  CheckableSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  RadioGroup as FluentRadioGroup,
  Radio,
  Checkbox,
  ToggleButton,
  Input,
  Label,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

type _Option = any;

// Extend the vendor ChoicePickerApi with an optional action that fires on selection change
const FlexibleChoicePickerApi = {
  name: 'ChoicePicker' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema.optional(),
    variant: z.enum(['multipleSelection', 'mutuallyExclusive']).default('mutuallyExclusive').optional(),
    options: z.array(z.object({
      label: DynamicStringSchema,
      value: z.string(),
    })),
    value: DynamicStringListSchema,
    displayStyle: z.enum(['checkbox', 'chips']).default('checkbox').optional(),
    filterable: z.boolean().default(false).optional(),
    action: ActionSchema.optional(),
    checks: CheckableSchema.shape.checks,
  }),
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  chipContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export const ChoicePicker = createReactComponent(FlexibleChoicePickerApi, ({props}) => {
  const [filter, setFilter] = useState('');
  const classes = useStyles();

  const values = Array.isArray(props.value) ? props.value : [];
  const isMutuallyExclusive = props.variant === 'mutuallyExclusive';

  const fireAction = () => {
    if (typeof props.action === 'function') {
      (props.action as () => void)();
    }
  };

  const onToggle = (val: string) => {
    if (isMutuallyExclusive) {
      props.setValue([val]);
    } else {
      const newValues = values.includes(val)
        ? values.filter((v: string) => v !== val)
        : [...values, val];
      props.setValue(newValues);
    }
    fireAction();
  };

  const onRadioChange = (_e: unknown, data: { value: string }) => {
    props.setValue([data.value]);
    fireAction();
  };

  const options = (props.options || []).filter(
    (opt: _Option) =>
      !props.filterable ||
      filter === '' ||
      String(opt.label).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className={classes.root}>
      {props.label && <Label weight="semibold">{props.label}</Label>}
      {props.filterable && (
        <Input
          placeholder="Filter options..."
          aria-label="Filter options"
          value={filter}
          onChange={(_e, data) => setFilter(data.value)}
        />
      )}

      {props.displayStyle === 'chips' ? (
        <div className={classes.chipContainer}>
          {options.map((opt: _Option, i: number) => {
            const isSelected = values.includes(opt.value);
            return (
              <ToggleButton
                key={i}
                checked={isSelected}
                onClick={() => onToggle(opt.value)}
                shape="circular"
                size="small"
              >
                {opt.label}
              </ToggleButton>
            );
          })}
        </div>
      ) : isMutuallyExclusive ? (
        <FluentRadioGroup
          value={values[0] || ''}
          onChange={onRadioChange}
        >
          {options.map((opt: _Option, i: number) => (
            <Radio key={i} value={opt.value} label={opt.label} />
          ))}
        </FluentRadioGroup>
      ) : (
        <div className={classes.listContainer}>
          {options.map((opt: _Option, i: number) => (
            <Checkbox
              key={i}
              checked={values.includes(opt.value)}
              label={opt.label}
              onChange={() => onToggle(opt.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
