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
import {CheckBoxApi} from '../../../../web_core/basic_catalog/index';
import {Checkbox, Field, makeStyles, tokens} from '@fluentui/react-components';
import type {CheckboxOnChangeData} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const CheckBox = createReactComponent(CheckBoxApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
    props.setValue(!!data.checked);
  };

  const hasError = props.validationErrors && props.validationErrors.length > 0;

  return (
    <div className={classes.root}>
      <Field
        validationMessage={hasError ? props.validationErrors?.[0] : undefined}
        validationState={hasError ? 'error' : 'none'}
      >
        <Checkbox checked={!!props.value} onChange={onChange} label={props.label || undefined} />
      </Field>
    </div>
  );
});
