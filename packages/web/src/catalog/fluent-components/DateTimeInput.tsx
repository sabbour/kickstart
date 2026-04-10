import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {DateTimeInputApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Input, Field, makeStyles, tokens} from '@fluentui/react-components';
import type {InputOnChangeData} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const DateTimeInput = createReactComponent(DateTimeInputApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    props.setValue(data.value);
  };

  let type = 'datetime-local';
  if (props.enableDate && !props.enableTime) type = 'date';
  if (!props.enableDate && props.enableTime) type = 'time';

  return (
    <div className={classes.root}>
      <Field label={props.label || undefined}>
        <Input
          type={type as 'text' | 'date' | 'time' | 'datetime-local'}
          value={props.value || ''}
          onChange={onChange}
          min={typeof props.min === 'string' ? props.min : undefined}
          max={typeof props.max === 'string' ? props.max : undefined}
        />
      </Field>
    </div>
  );
});
