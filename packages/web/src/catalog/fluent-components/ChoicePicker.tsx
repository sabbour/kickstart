import React, {useState} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ChoicePickerApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
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

export const ChoicePicker = createReactComponent(ChoicePickerApi, ({props}) => {
  const [filter, setFilter] = useState('');
  const classes = useStyles();

  const values = Array.isArray(props.value) ? props.value : [];
  const isMutuallyExclusive = props.variant === 'mutuallyExclusive';

  const onToggle = (val: string) => {
    if (isMutuallyExclusive) {
      props.setValue([val]);
    } else {
      const newValues = values.includes(val)
        ? values.filter((v: string) => v !== val)
        : [...values, val];
      props.setValue(newValues);
    }
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
          onChange={(_e, data) => props.setValue([data.value])}
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
