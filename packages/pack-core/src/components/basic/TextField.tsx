import React, {useState, useEffect, useRef} from 'react';
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
  const [localValue, setLocalValue] = useState(props.value || '');
  const userEdited = useRef(false);

  // Sync from external prop changes and clear the local edit lock once applied
  useEffect(() => {
    const nextValue = props.value || '';
    setLocalValue(currentValue => (currentValue === nextValue ? currentValue : nextValue));
    userEdited.current = false;
  }, [props.value]);

  const isLong = props.variant === 'longText';
  const type =
    props.variant === 'number' ? 'number' : props.variant === 'obscured' ? 'password' : 'text';

  const hasError = props.validationErrors && props.validationErrors.length > 0;

  const onInputChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    userEdited.current = true;
    setLocalValue(data.value);
    props.setValue(data.value);
  };

  const onTextareaChange = (_ev: React.ChangeEvent<HTMLTextAreaElement>, data: TextareaOnChangeData) => {
    userEdited.current = true;
    setLocalValue(data.value);
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
            value={localValue}
            onChange={onTextareaChange}
          />
        ) : (
          <Input
            type={type}
            value={localValue}
            onChange={onInputChange}
          />
        )}
      </Field>
    </div>
  );
});
