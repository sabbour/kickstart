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
import { type ComponentContext } from '../web_core/index';
import type { ComponentApi, InferredComponentApiSchemaType, ResolveA2uiProps } from '../web_core/index';
export interface ReactComponentImplementation extends ComponentApi {
    /** The framework-specific rendering wrapper. */
    render: React.FC<{
        context: ComponentContext;
        buildChild: (id: string, basePath?: string) => React.ReactNode;
    }>;
}
export type ReactA2uiComponentProps<T> = {
    props: T;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
    context: ComponentContext;
};
/**
 * Creates a React component implementation using the deep generic binder.
 */
export declare function createReactComponent<Api extends ComponentApi>(api: Api, RenderComponent: React.FC<ReactA2uiComponentProps<ResolveA2uiProps<InferredComponentApiSchemaType<Api>>>>): ReactComponentImplementation;
/**
 * Creates a React component implementation that manages its own context bindings (no generic binder).
 */
export declare function createBinderlessComponent(api: ComponentApi, RenderComponent: React.FC<{
    context: ComponentContext;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
}>): ReactComponentImplementation;
//# sourceMappingURL=adapter.d.ts.map