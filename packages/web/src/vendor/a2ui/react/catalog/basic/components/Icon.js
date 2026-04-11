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
import { IconApi } from '../../../../web_core/basic_catalog/index';
import { Body1, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.colorNeutralForeground1,
    },
    text: {
        fontSize: tokens.fontSizeBase500,
        width: '24px',
        height: '24px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
export const Icon = createReactComponent(IconApi, ({ props }) => {
    const classes = useStyles();
    const iconName = typeof props.name === 'string' ? props.name : props.name?.path;
    if (!iconName) {
        return <Body1>{'?'}</Body1>;
    }
    return (<span className={`${classes.root} ${classes.text}`}>
      {iconName}
    </span>);
});
//# sourceMappingURL=Icon.js.map