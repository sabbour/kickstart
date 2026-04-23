/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import {createReactComponent} from '../../../adapter';
import {TextFieldApi} from '../../../../web_core/basic_catalog/index';
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

  const onTextareaChange = (
    _ev: React.ChangeEvent<HTMLTextAreaElement>,
    data: TextareaOnChangeData
  ) => {
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
          <Textarea value={props.value || ''} onChange={onTextareaChange} />
        ) : (
          <Input type={type} value={props.value || ''} onChange={onInputChange} />
        )}
      </Field>
    </div>
  );
});
