import React from 'react';
import { z } from 'zod';
import type { ComponentContext } from '../web_core/index';
import type { ComponentApi, InferredComponentApiSchemaType, ResolveA2uiProps } from '../web_core/catalog/types';

export interface ReactA2uiComponentProps<T> {
  props: T;
  buildChild: (id: string, basePath?: string) => React.ReactNode;
  context: ComponentContext;
}

export interface ReactComponentImplementation extends ComponentApi {
  render: React.FC<{
    context: ComponentContext;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
  }>;
}

export function createReactComponent<Api extends ComponentApi>(
  api: Api,
  RenderComponent: React.FC<ReactA2uiComponentProps<ResolveA2uiProps<InferredComponentApiSchemaType<Api>>>>
): ReactComponentImplementation {
  return {
    name: api.name,
    schema: api.schema,
    render: RenderComponent as React.FC<{
      context: ComponentContext;
      buildChild: (id: string, basePath?: string) => React.ReactNode;
    }>,
  };
}

export function createBinderlessComponent(
  api: ComponentApi,
  RenderComponent: React.FC<{
    context: ComponentContext;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
  }>
): ReactComponentImplementation {
  return {
    name: api.name,
    schema: api.schema,
    render: RenderComponent,
  };
}
