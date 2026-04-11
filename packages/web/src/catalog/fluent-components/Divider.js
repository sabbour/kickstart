import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { DividerApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { Divider as FluentDivider, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
    },
});
export const Divider = createReactComponent(DividerApi, ({ props }) => {
    const classes = useStyles();
    const isVertical = props.axis === 'vertical';
    return (<FluentDivider className={classes.root} vertical={isVertical}/>);
});
//# sourceMappingURL=Divider.js.map