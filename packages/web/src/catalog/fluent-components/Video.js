import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { VideoApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        width: '100%',
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        aspectRatio: '16/9',
    },
});
export const Video = createReactComponent(VideoApi, ({ props }) => {
    const classes = useStyles();
    return (<video src={props.url} controls className={classes.root}/>);
});
//# sourceMappingURL=Video.js.map