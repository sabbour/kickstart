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
import { tokens } from '@fluentui/react-components';
/** Standard leaf margin using Fluent spacing token. */
export const LEAF_MARGIN = tokens.spacingVerticalS;
/** Standard internal padding using Fluent spacing token. */
export const CONTAINER_PADDING = tokens.spacingHorizontalL;
/** Standard border using Fluent stroke token. */
export const STANDARD_BORDER = `1px solid ${tokens.colorNeutralStroke1}`;
/** Standard border radius using Fluent radius token. */
export const STANDARD_RADIUS = tokens.borderRadiusMedium;
export const mapJustify = (j) => {
    switch (j) {
        case 'center':
            return 'center';
        case 'end':
            return 'flex-end';
        case 'spaceAround':
            return 'space-around';
        case 'spaceBetween':
            return 'space-between';
        case 'spaceEvenly':
            return 'space-evenly';
        case 'start':
            return 'flex-start';
        case 'stretch':
            return 'stretch';
        default:
            return 'flex-start';
    }
};
export const mapAlign = (a) => {
    switch (a) {
        case 'start':
            return 'flex-start';
        case 'center':
            return 'center';
        case 'end':
            return 'flex-end';
        case 'stretch':
            return 'stretch';
        default:
            return 'stretch';
    }
};
//# sourceMappingURL=utils.js.map