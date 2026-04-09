import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {TextFieldApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {Input, Textarea, Field, makeStyles, tokens} from '@fluentui/react-components';
import type {InputOnChangeData, TextareaOnChangeData} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const TextField = createReactComponent(TextFieldApi, ({props}) => {
  const classes = useStyles();

  const isLong = props.variant === 'longText';
  const type =
    props.variant === 'number' ? 'number' : props.variant === 'obscured' ? 'password' : 'text';

  const hasError = props.validationErrors && props.validationErrors.length > 0;

  const onInputChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    props.setValue(data.value);
  };

  const onTextareaChange = (_ev: React.ChangeEvent<HTMLTextAreaElement>, data: TextareaOnChangeData) => {
    props.setValue(data.value);
  };

  return (
    <div className={classes.root}>
      <Field
        label={props.label || undefined}
        validationMessage={hasError ? props.validationErrors![0] : undefined}
        validationState={hasError ? 'error' : 'none'}
      >
        {isLong ? (
          <Textarea
            value={props.value || ''}
            onChange={onTextareaChange}
          />
        ) : (
          <Input
            type={type}
            value={props.value || ''}
            onChange={onInputChange}
          />
        )}
      </Field>
    </div>
  );
});
