import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { IconApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { Body1, makeStyles, tokens } from '@fluentui/react-components';
import { getFluentIcon } from '../icons/fluent-icons';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.colorNeutralForeground1,
    },
    img: {
        width: '24px',
        height: '24px',
        objectFit: 'contain',
    },
    text: {
        fontSize: tokens.fontSizeBase500,
        width: '24px',
        height: '24px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
export const Icon = createReactComponent(IconApi, ({ props }) => {
    const classes = useStyles();
    const iconName = typeof props.name === 'string' ? props.name : props.name?.path;
    if (!iconName) {
        return <Body1>?</Body1>;
    }
    // Fluent UI React icons — look up by name in registry
    const FluentIcon = getFluentIcon(iconName);
    if (FluentIcon) {
        return (<span className={classes.root}>
        <FluentIcon fontSize={24}/>
      </span>);
    }
    // SVG path-based icons (from /assets/icons/...)
    if (iconName.startsWith('/')) {
        return (<span className={classes.root}>
        <img src={iconName} alt={iconName.split('/').pop() || 'icon'} className={classes.img}/>
      </span>);
    }
    // Text-based fallback (Material Symbols via CSS class, or plain text)
    return (<span className={`${classes.root} ${classes.text}`}>
      {iconName}
    </span>);
});
//# sourceMappingURL=Icon.js.map