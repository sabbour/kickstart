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
import {SliderApi} from '../../../../web_core/basic_catalog/index';
import {
  Slider as FluentSlider,
  Label,
  Body1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type {SliderOnChangeData} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
  },
});

export const Slider = createReactComponent(SliderApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: SliderOnChangeData) => {
    props.setValue(data.value);
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        {props.label && <Label weight="semibold">{props.label}</Label>}
        <Body1>{props.value}</Body1>
      </div>
      <FluentSlider
        min={props.min ?? 0}
        max={props.max}
        value={props.value ?? 0}
        onChange={onChange}
      />
    </div>
  );
});
