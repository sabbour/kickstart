import React, {useState} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  ComponentIdSchema,
  DynamicStringSchema,
  ChildListSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {TabList, Tab, makeStyles, tokens} from '@fluentui/react-components';
import type {SelectTabData, SelectTabEvent} from '@fluentui/react-components';
import {ChildList} from './ChildList';

type _Tab = any;

/**
 * Custom API matching the backend schema (label + children[]) rather than the
 * vendor TabsApi which expects title + child (singular).
 */
const KickstartTabsApi = {
  name: 'Tabs' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    tabs: z.array(z.object({
      label: DynamicStringSchema.optional(),
      title: DynamicStringSchema.optional(),
      child: ComponentIdSchema.optional(),
      children: ChildListSchema.optional(),
    }).refine((tab) => tab.label != null || tab.title != null, {
      message: 'Each tab must provide at least one of "label" or "title".',
    })).min(1),
  }),
};

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
    paddingTop: tokens.spacingVerticalS,
  },
});

export const Tabs = createReactComponent(KickstartTabsApi, ({props, buildChild, context}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const classes = useStyles();

  const tabs = props.tabs || [];
  const activeTab = tabs[selectedIndex];

  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedIndex(data.value as number);
  };

  // Resolve the display label: prefer label, fall back to title
  const getTabLabel = (tab: _Tab): string => String(tab.label ?? tab.title ?? 'Tab');

  return (
    <div className={classes.root}>
      <TabList selectedValue={selectedIndex} onTabSelect={onTabSelect}>
        {tabs.map((tab: _Tab, i: number) => (
          <Tab key={i} value={i}>
            {getTabLabel(tab)}
          </Tab>
        ))}
      </TabList>
      <div className={classes.content}>
        {activeTab ? (
          activeTab.children ? (
            <ChildList childList={activeTab.children} buildChild={buildChild} context={context} />
          ) : activeTab.child ? (
            buildChild(activeTab.child)
          ) : null
        ) : null}
      </div>
    </div>
  );
});
