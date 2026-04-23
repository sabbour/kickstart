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

import {useState} from 'react';
import {createReactComponent} from '../../../adapter';
import {TabsApi} from '../../../../web_core/basic_catalog/index';
import {TabList, Tab, makeStyles, tokens} from '@fluentui/react-components';
import type {SelectTabData, SelectTabEvent} from '@fluentui/react-components';

// The type of a tab is deeply nested into the TabsApi schema, and
// it seems z.infer is not inferring it correctly (?). We use `any` for now.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type _Tab = any;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  content: {
    flex: '1',
  },
});

export const Tabs = createReactComponent(TabsApi, ({props, buildChild}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const classes = useStyles();

  const tabs = props.tabs || [];
  const activeTab = tabs[selectedIndex];

  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedIndex(data.value as number);
  };

  return (
    <div className={classes.root}>
      <TabList selectedValue={selectedIndex} onTabSelect={onTabSelect}>
        {tabs.map((tab: _Tab, i: number) => (
          <Tab key={i} value={i}>
            {tab.title}
          </Tab>
        ))}
      </TabList>
      <div className={classes.content}>{activeTab ? buildChild(activeTab.child) : null}</div>
    </div>
  );
});
