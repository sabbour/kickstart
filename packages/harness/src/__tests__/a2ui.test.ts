import { describe, expect, it } from 'vitest';
import {
  A2UIMessageSchema,
  CreateSurfaceMessageSchema,
  DeleteSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
} from '../types/a2ui.js';

describe('A2UI schemas', () => {
  it('parses a valid createSurface message', () => {
    const message = CreateSurfaceMessageSchema.parse({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'phase-indicator',
        catalogId: 'kickstart',
      },
    });

    expect(message).toEqual({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'phase-indicator',
        catalogId: 'kickstart',
      },
    });
  });

  it('parses a valid updateComponents message', () => {
    expect(UpdateComponentsMessageSchema.parse({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'phase-indicator',
        components: [{ component: 'Text', text: 'hello' }],
      },
    })).toEqual({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'phase-indicator',
        components: [{ component: 'Text', text: 'hello' }],
      },
    });
  });

  it('parses a valid updateDataModel message', () => {
    expect(UpdateDataModelMessageSchema.parse({
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'phase-indicator',
        path: 'app.name',
        value: 'kickstart',
      },
    })).toEqual({
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'phase-indicator',
        path: 'app.name',
        value: 'kickstart',
      },
    });
  });

  it('parses a valid deleteSurface message', () => {
    expect(DeleteSurfaceMessageSchema.parse({
      version: 'v0.9',
      deleteSurface: {
        surfaceId: 'phase-indicator',
      },
    })).toEqual({
      version: 'v0.9',
      deleteSurface: {
        surfaceId: 'phase-indicator',
      },
    });
  });

  it('rejects multiple operations in one message', () => {
    expect(() => A2UIMessageSchema.parse({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'phase-indicator',
        catalogId: 'kickstart',
      },
      updateComponents: {
        surfaceId: 'phase-indicator',
        components: [{ component: 'Text', text: 'hello' }],
      },
    })).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => A2UIMessageSchema.parse({
      version: 'v0.9',
      deleteSurface: {
        surfaceId: 'phase-indicator',
      },
      extra: true,
    })).toThrow();
  });

  it('rejects invalid versions', () => {
    expect(() => A2UIMessageSchema.parse({
      version: 'v1.0',
      deleteSurface: {
        surfaceId: 'phase-indicator',
      },
    })).toThrow();
  });
});
