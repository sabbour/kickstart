import { z } from 'zod';

export const A2UI_VERSION = 'v0.9' as const;
export type A2UIVersion = typeof A2UI_VERSION;

export type A2UIComponent = Record<string, unknown>;
export type A2UIDataValue = unknown;

export const CreateSurfaceMessagePayload = z.object({
  surfaceId: z.string(),
  catalogId: z.string(),
  theme: z.unknown().optional(),
  sendDataModel: z.boolean().optional(),
}).strict();

export const UpdateComponentsMessagePayload = z.object({
  surfaceId: z.string(),
  components: z.array(z.unknown()).min(1),
}).strict();

export const UpdateDataModelMessagePayload = z.object({
  surfaceId: z.string(),
  path: z.string().optional(),
  value: z.unknown().optional(),
}).strict();

export const DeleteSurfaceMessagePayload = z.object({
  surfaceId: z.string(),
}).strict();

const CreateSurfaceEnvelope = z.object({
  version: z.literal(A2UI_VERSION),
  op: z.literal('createSurface'),
  createSurface: CreateSurfaceMessagePayload,
}).strict();

const UpdateComponentsEnvelope = z.object({
  version: z.literal(A2UI_VERSION),
  op: z.literal('updateComponents'),
  updateComponents: UpdateComponentsMessagePayload,
}).strict();

const UpdateDataModelEnvelope = z.object({
  version: z.literal(A2UI_VERSION),
  op: z.literal('updateDataModel'),
  updateDataModel: UpdateDataModelMessagePayload,
}).strict();

const DeleteSurfaceEnvelope = z.object({
  version: z.literal(A2UI_VERSION),
  op: z.literal('deleteSurface'),
  deleteSurface: DeleteSurfaceMessagePayload,
}).strict();

export const A2UIMessageEnvelopeSchema = z.discriminatedUnion('op', [
  CreateSurfaceEnvelope,
  UpdateComponentsEnvelope,
  UpdateDataModelEnvelope,
  DeleteSurfaceEnvelope,
]);

export type A2UIMessageEnvelope = z.infer<typeof A2UIMessageEnvelopeSchema>;

function withDiscriminator(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  const keys = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface']
    .filter((key) => key in candidate);

  if (keys.length !== 1) {
    return value;
  }

  return {
    ...candidate,
    op: keys[0],
  };
}

function withoutDiscriminator<T extends { op: string }>(value: T): Omit<T, 'op'> {
  const { op: _op, ...rest } = value;
  return rest;
}

export const CreateSurfaceMessageSchema = z.preprocess(
  withDiscriminator,
  CreateSurfaceEnvelope.transform(withoutDiscriminator),
);

export const UpdateComponentsMessageSchema = z.preprocess(
  withDiscriminator,
  UpdateComponentsEnvelope.transform(withoutDiscriminator),
);

export const UpdateDataModelMessageSchema = z.preprocess(
  withDiscriminator,
  UpdateDataModelEnvelope.transform(withoutDiscriminator),
);

export const DeleteSurfaceMessageSchema = z.preprocess(
  withDiscriminator,
  DeleteSurfaceEnvelope.transform(withoutDiscriminator),
);

export const A2UIMessageSchema = z.preprocess(
  withDiscriminator,
  A2UIMessageEnvelopeSchema.transform(withoutDiscriminator),
);

export type CreateSurfaceMessage = z.output<typeof CreateSurfaceMessageSchema>;
export type UpdateComponentsMessage = z.output<typeof UpdateComponentsMessageSchema>;
export type UpdateDataModelMessage = z.output<typeof UpdateDataModelMessageSchema>;
export type DeleteSurfaceMessage = z.output<typeof DeleteSurfaceMessageSchema>;
export type A2UIMessageV09 =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

export type CreateSurfaceMessageInput = {
  version: A2UIVersion;
  createSurface: z.input<typeof CreateSurfaceMessagePayload>;
};

export type UpdateComponentsMessageInput = {
  version: A2UIVersion;
  updateComponents: z.input<typeof UpdateComponentsMessagePayload>;
};

export type UpdateDataModelMessageInput = {
  version: A2UIVersion;
  updateDataModel: z.input<typeof UpdateDataModelMessagePayload>;
};

export type DeleteSurfaceMessageInput = {
  version: A2UIVersion;
  deleteSurface: z.input<typeof DeleteSurfaceMessagePayload>;
};

export type A2UIMessageInput =
  | CreateSurfaceMessageInput
  | UpdateComponentsMessageInput
  | UpdateDataModelMessageInput
  | DeleteSurfaceMessageInput;
