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
import { createReactComponent } from '../../../adapter';
import { ImageApi } from '../../../../web_core/basic_catalog/index';
import { Image as FluentImage, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        display: 'block',
        width: '100%',
        height: 'auto',
    },
    icon: {
        width: '24px',
        height: '24px',
    },
    avatar: {
        width: '40px',
        height: '40px',
    },
    smallFeature: {
        maxWidth: '100px',
    },
    largeFeature: {
        maxHeight: '400px',
    },
    header: {
        height: '200px',
    },
});
export const Image = createReactComponent(ImageApi, ({ props }) => {
    const classes = useStyles();
    const mapFit = (fit) => {
        if (fit === 'scaleDown')
            return 'none';
        if (fit === 'contain')
            return 'contain';
        if (fit === 'cover')
            return 'cover';
        if (fit === 'none')
            return 'none';
        return 'default';
    };
    let className = classes.root;
    let shape;
    if (props.variant === 'icon') {
        className = `${classes.root} ${classes.icon}`;
    }
    else if (props.variant === 'avatar') {
        className = `${classes.root} ${classes.avatar}`;
        shape = 'circular';
    }
    else if (props.variant === 'smallFeature') {
        className = `${classes.root} ${classes.smallFeature}`;
    }
    else if (props.variant === 'largeFeature') {
        className = `${classes.root} ${classes.largeFeature}`;
    }
    else if (props.variant === 'header') {
        className = `${classes.root} ${classes.header}`;
    }
    return (<FluentImage className={className} src={props.url} alt={props.description || ''} fit={mapFit(props.fit)} shape={shape}/>);
});
//# sourceMappingURL=Image.js.map