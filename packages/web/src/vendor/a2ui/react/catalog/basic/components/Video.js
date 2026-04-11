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
import { VideoApi } from '../../../../web_core/basic_catalog/index';
import { makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        width: '100%',
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        aspectRatio: '16/9',
    },
});
export const Video = createReactComponent(VideoApi, ({ props }) => {
    const classes = useStyles();
    return <video src={props.url} controls className={classes.root}/>;
});
//# sourceMappingURL=Video.js.map