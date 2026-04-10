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
import {ButtonApi} from '../../../../web_core/basic_catalog/index';
import {Button as FluentButton, makeStyles, tokens} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
  },
});

export const Button = createReactComponent(ButtonApi, ({props, buildChild}) => {
  const classes = useStyles();

  const appearance = (() => {
    switch (props.variant) {
      case 'primary':
        return 'primary';
      case 'borderless':
        return 'transparent';
      case 'outlined':
        return 'outline';
      default:
        return 'secondary';
    }
  })();

  return (
    <FluentButton
      className={classes.root}
      appearance={appearance as 'primary' | 'transparent' | 'outline' | 'secondary'}
      onClick={props.action}
      disabled={props.isValid === false}
    >
      {props.child ? buildChild(props.child) : null}
    </FluentButton>
  );
});
