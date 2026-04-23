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
import {ListApi} from '../../../../web_core/basic_catalog/index';
import {ChildList} from './ChildList';
import {mapAlign} from '../utils';
import {makeStyles} from '@fluentui/react-components';

const useStyles = makeStyles({
  horizontal: {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
    width: '100%',
    margin: '0',
    padding: '0',
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    overflowY: 'auto',
    width: '100%',
    margin: '0',
    padding: '0',
  },
});

export const List = createReactComponent(ListApi, ({props, buildChild, context}) => {
  const classes = useStyles();
  const isHorizontal = props.direction === 'horizontal';

  return (
    <div
      className={isHorizontal ? classes.horizontal : classes.vertical}
      style={{alignItems: mapAlign(props.align)}}
    >
      <ChildList childList={props.children} buildChild={buildChild} context={context} />
    </div>
  );
});
