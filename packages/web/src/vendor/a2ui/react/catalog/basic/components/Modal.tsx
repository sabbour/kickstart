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
import {ModalApi} from '../../../../web_core/basic_catalog/index';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {DismissRegular} from '@fluentui/react-icons';

const useStyles = makeStyles({
  trigger: {
    display: 'inline-block',
  },
  surface: {
    maxWidth: '600px',
    padding: tokens.spacingHorizontalXXL,
  },
});

export const Modal = createReactComponent(ModalApi, ({props, buildChild}) => {
  const [isOpen, setIsOpen] = useState(false);
  const classes = useStyles();

  return (
    <Dialog open={isOpen} onOpenChange={(_e, data) => setIsOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <div className={classes.trigger}>
          {props.trigger ? buildChild(props.trigger) : null}
        </div>
      </DialogTrigger>
      <DialogSurface className={classes.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="Close"
                  icon={<DismissRegular />}
                />
              </DialogTrigger>
            }
          />
          <DialogContent>
            {props.content ? buildChild(props.content) : null}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">{'Close'}</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
