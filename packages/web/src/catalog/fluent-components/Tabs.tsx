import {useState} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {TabsApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {TabList, Tab, makeStyles, tokens} from '@fluentui/react-components';
import type {SelectTabData, SelectTabEvent} from '@fluentui/react-components';

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
