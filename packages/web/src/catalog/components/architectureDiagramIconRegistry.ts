const ARCHITECTURE_DIAGRAM_ICON_PATHS = {
  'azure/aks': '/assets/icons/compute/kubernetes-services.svg',
  'azure/acr': '/assets/icons/containers/container-registries.svg',
  'azure/postgresql': '/assets/icons/databases/azure-database-postgresql-server.svg',
  'azure/sql': '/assets/icons/databases/azure-sql.svg',
  'azure/cosmos-db': '/assets/icons/databases/azure-sql.svg',
  'azure/redis': '/assets/icons/databases/cache-redis.svg',
  'azure/storage': '/assets/icons/storage/storage-accounts.svg',
  'azure/key-vault': '/assets/icons/security/key-vaults.svg',
  'k8s/deploy': '/assets/icons/k8s/deploy.svg',
  'k8s/svc': '/assets/icons/k8s/svc.svg',
  'k8s/sa': '/assets/icons/k8s/sa.svg',
  'k8s/ns': '/assets/icons/k8s/ns.svg',
  'k8s/hpa': '/assets/icons/k8s/hpa.svg',
} as const;

const ARCHITECTURE_DIAGRAM_ICON_REGISTRY = new Map<string, string>(
  Object.entries(ARCHITECTURE_DIAGRAM_ICON_PATHS),
);

export const ARCHITECTURE_DIAGRAM_HEADER_ICON_URL =
  '/assets/icons/fluent/building-cloud.svg';
export const ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL =
  '/assets/icons/fluent/design-ideas.svg';

export function getArchitectureDiagramIconRegistry(): ReadonlyMap<string, string> {
  return ARCHITECTURE_DIAGRAM_ICON_REGISTRY;
}
