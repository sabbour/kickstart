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
import { TextApi } from '../../../../web_core/basic_catalog/index';
import { Title1, Title2, Title3, Subtitle1, Subtitle2, Caption1, Body1, makeStyles, tokens, } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
        display: 'inline-block',
    },
});
export const Text = createReactComponent(TextApi, ({ props }) => {
    const classes = useStyles();
    const text = props.text ?? '';
    switch (props.variant) {
        case 'h1':
            return <Title1 className={classes.root} block>{text}</Title1>;
        case 'h2':
            return <Title2 className={classes.root} block>{text}</Title2>;
        case 'h3':
            return <Title3 className={classes.root} block>{text}</Title3>;
        case 'h4':
            return <Subtitle1 className={classes.root} block>{text}</Subtitle1>;
        case 'h5':
            return <Subtitle2 className={classes.root} block>{text}</Subtitle2>;
        case 'caption':
            return <Caption1 className={classes.root}>{text}</Caption1>;
        case 'body':
        default:
            return <Body1 className={classes.root}>{text}</Body1>;
    }
});
//# sourceMappingURL=Text.js.map