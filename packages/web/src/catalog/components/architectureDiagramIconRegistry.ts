const ARCHITECTURE_DIAGRAM_ICON_PATHS = {
  'azure/aks': '/assets/architecture-diagram/azure/aks.svg',
  'azure/acr': '/assets/architecture-diagram/azure/acr.svg',
  'azure/postgresql': '/assets/architecture-diagram/azure/postgresql.svg',
  'azure/sql': '/assets/architecture-diagram/azure/sql.svg',
  'azure/cosmos-db': '/assets/architecture-diagram/azure/sql.svg',
  'azure/redis': '/assets/architecture-diagram/azure/redis.svg',
  'azure/storage': '/assets/architecture-diagram/azure/storage.svg',
  'azure/key-vault': '/assets/architecture-diagram/azure/key-vault.svg',
  'k8s/deploy': '/assets/architecture-diagram/k8s/deploy.svg',
  'k8s/svc': '/assets/architecture-diagram/k8s/svc.svg',
  'k8s/sa': '/assets/architecture-diagram/k8s/sa.svg',
  'k8s/ns': '/assets/architecture-diagram/k8s/ns.svg',
  'k8s/hpa': '/assets/architecture-diagram/k8s/hpa.svg',
} as const;

const ARCHITECTURE_DIAGRAM_ICON_REGISTRY = new Map<string, string>(
  Object.entries(ARCHITECTURE_DIAGRAM_ICON_PATHS),
);

export const ARCHITECTURE_DIAGRAM_HEADER_ICON_URL =
  '/assets/architecture-diagram/fluent/building-cloud.svg';
export const ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL =
  '/assets/architecture-diagram/fluent/design-ideas.svg';

export function getArchitectureDiagramIconRegistry(): ReadonlyMap<string, string> {
  return ARCHITECTURE_DIAGRAM_ICON_REGISTRY;
}
