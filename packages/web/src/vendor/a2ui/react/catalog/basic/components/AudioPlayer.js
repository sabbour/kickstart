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
import { AudioPlayerApi } from '../../../../web_core/basic_catalog/index';
import { Caption1, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        width: '100%',
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
    },
    audio: {
        width: '100%',
    },
});
export const AudioPlayer = createReactComponent(AudioPlayerApi, ({ props }) => {
    const classes = useStyles();
    return (<div className={classes.root}>
      {props.description && <Caption1>{props.description}</Caption1>}
      <audio src={props.url} controls className={classes.audio}/>
    </div>);
});
//# sourceMappingURL=AudioPlayer.js.map