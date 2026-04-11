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
import { LinkApi } from '../../../../web_core/basic_catalog/index';
import { Link as FluentLink, makeStyles, tokens, } from '@fluentui/react-components';
import { OpenRegular } from '@fluentui/react-icons';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalXXS,
        marginBottom: tokens.spacingVerticalXXS,
    },
    icon: {
        marginLeft: tokens.spacingHorizontalXXS,
        fontSize: '12px',
        verticalAlign: 'middle',
    },
});
export const Link = createReactComponent(LinkApi, ({ props }) => {
    const classes = useStyles();
    const isExternal = props.external === true;
    return (<FluentLink className={classes.root} href={props.url ?? '#'} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} inline>
      {props.text ?? ''}
      {isExternal && <OpenRegular className={classes.icon}/>}
    </FluentLink>);
});
//# sourceMappingURL=Link.js.map