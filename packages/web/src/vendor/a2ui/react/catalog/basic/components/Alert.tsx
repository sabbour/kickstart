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

import React, {useState} from 'react';
import {createReactComponent} from '../../../adapter';
import {AlertApi} from '../../../../web_core/basic_catalog/index';
import {
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {DismissRegular} from '@fluentui/react-icons';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
});

const severityToIntent = (severity?: string) => {
  switch (severity) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'success': return 'success';
    case 'info':
    default: return 'info';
  }
};

export const Alert = createReactComponent(AlertApi, ({props}) => {
  const classes = useStyles();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <MessageBar
      className={classes.root}
      intent={severityToIntent(props.severity) as 'info' | 'warning' | 'error' | 'success'}
    >
      <MessageBarBody>{props.message ?? ''}</MessageBarBody>
      {(props.dismissible || props.action) && (
        <MessageBarActions
          containerAction={
            props.dismissible ? (
              <Button
                aria-label="dismiss"
                appearance="transparent"
                icon={<DismissRegular />}
                onClick={() => setDismissed(true)}
              />
            ) : undefined
          }
        >
          {props.action && (
            <Button appearance="transparent" onClick={props.action}>
              Action
            </Button>
          )}
        </MessageBarActions>
      )}
    </MessageBar>
  );
});
