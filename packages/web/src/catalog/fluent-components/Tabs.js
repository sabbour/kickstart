import { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { TabsApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { TabList, Tab, makeStyles, tokens } from '@fluentui/react-components';
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
export const Tabs = createReactComponent(TabsApi, ({ props, buildChild }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const classes = useStyles();
    const tabs = props.tabs || [];
    const activeTab = tabs[selectedIndex];
    const onTabSelect = (_event, data) => {
        setSelectedIndex(data.value);
    };
    return (<div className={classes.root}>
      <TabList selectedValue={selectedIndex} onTabSelect={onTabSelect}>
        {tabs.map((tab, i) => (<Tab key={i} value={i}>
            {tab.title}
          </Tab>))}
      </TabList>
      <div className={classes.content}>{activeTab ? buildChild(activeTab.child) : null}</div>
    </div>);
});
//# sourceMappingURL=Tabs.js.map