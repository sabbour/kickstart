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
import { createReactComponent } from '../../../adapter';
import { DateTimeInputApi } from '../../../../web_core/basic_catalog/index';
import { Input, Field, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
    },
});
export const DateTimeInput = createReactComponent(DateTimeInputApi, ({ props }) => {
    const classes = useStyles();
    const onChange = (_ev, data) => {
        props.setValue(data.value);
    };
    // Map enableDate/enableTime to input type
    let type = 'datetime-local';
    if (props.enableDate && !props.enableTime)
        type = 'date';
    if (!props.enableDate && props.enableTime)
        type = 'time';
    return (<div className={classes.root}>
      <Field label={props.label || undefined}>
        <Input type={type} value={props.value || ''} onChange={onChange} min={typeof props.min === 'string' ? props.min : undefined} max={typeof props.max === 'string' ? props.max : undefined}/>
      </Field>
    </div>);
});
//# sourceMappingURL=DateTimeInput.js.map