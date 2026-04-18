export interface ComponentContext {
  componentModel: {
    id: string;
    properties: Record<string, unknown>;
  };
  dataContext: {
    path: string;
    resolveAction: (action: unknown) => { event: { context?: Record<string, unknown> } };
  };
  dispatchAction: (action: unknown) => void;
}
