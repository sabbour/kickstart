/**
 * Core rendering and state management logic for A2UI v0.9.
 *
 * This module exports the fundamental building blocks for building web-based A2UI renderers,
 * including the data model, component model, and expression parsing logic.
 */
export * from './catalog/function_invoker';
export * from './catalog/types';
export * from './common/events';
export * from './processing/message-processor';
export * from './rendering/component-context';
export * from './rendering/data-context';
export * from './rendering/generic-binder';
export * from './schema/index';
export * from './state/component-model';
export * from './state/data-model';
export * from './state/surface-components-model';
export * from './state/surface-group-model';
export * from './state/surface-model';
export * from './errors';
export { effect, Signal, signal, computed } from '@preact/signals-core';
export declare const Schemas: {
    A2uiMessageSchemaRaw: {
        $schema: string;
        $id: string;
        title: string;
        description: string;
        type: string;
        oneOf: {
            $ref: string;
        }[];
        $defs: {
            CreateSurfaceMessage: {
                type: string;
                properties: {
                    version: {
                        const: string;
                    };
                    createSurface: {
                        type: string;
                        description: string;
                        properties: {
                            surfaceId: {
                                type: string;
                                description: string;
                            };
                            catalogId: {
                                description: string;
                                type: string;
                            };
                            theme: {
                                $ref: string;
                                description: string;
                            };
                            sendDataModel: {
                                type: string;
                                description: string;
                            };
                        };
                        required: string[];
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
            UpdateComponentsMessage: {
                type: string;
                properties: {
                    version: {
                        const: string;
                    };
                    updateComponents: {
                        type: string;
                        description: string;
                        properties: {
                            surfaceId: {
                                type: string;
                                description: string;
                            };
                            components: {
                                type: string;
                                description: string;
                                minItems: number;
                                items: {
                                    $ref: string;
                                };
                            };
                        };
                        required: string[];
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
            UpdateDataModelMessage: {
                type: string;
                properties: {
                    version: {
                        const: string;
                    };
                    updateDataModel: {
                        type: string;
                        description: string;
                        properties: {
                            surfaceId: {
                                type: string;
                                description: string;
                            };
                            path: {
                                type: string;
                                description: string;
                            };
                            value: {
                                description: string;
                                additionalProperties: boolean;
                            };
                        };
                        required: string[];
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
            DeleteSurfaceMessage: {
                type: string;
                properties: {
                    version: {
                        const: string;
                    };
                    deleteSurface: {
                        type: string;
                        description: string;
                        properties: {
                            surfaceId: {
                                type: string;
                                description: string;
                            };
                        };
                        required: string[];
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
        };
    };
};
//# sourceMappingURL=index.d.ts.map