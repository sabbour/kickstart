const ARCHITECTURE_DIAGRAM_ICON_PATHS = {
  'azure/aks': '/assets/icons/compute/kubernetes-services.svg',
  'azure/aks-automatic': '/assets/icons/compute/aks-automatic.svg',
  'azure/acr': '/assets/icons/containers/container-registries.svg',
  'azure/postgresql': '/assets/icons/databases/azure-database-postgresql-server.svg',
  'azure/mysql': '/assets/icons/databases/azure-database-mysql-server.svg',
  'azure/sql': '/assets/icons/databases/azure-sql.svg',
  'azure/cosmos-db': '/assets/icons/databases/azure-sql.svg',
  'azure/redis': '/assets/icons/databases/cache-redis.svg',
  'azure/storage': '/assets/icons/storage/storage-accounts.svg',
  'azure/key-vault': '/assets/icons/security/key-vaults.svg',
  'azure/cognitive-services': '/assets/icons/ai and machine learning/cognitive-services.svg',
  'azure/app-gateway': '/assets/icons/networking/application-gateways.svg',
  'azure/front-door': '/assets/icons/networking/front-door-and-cdn-profiles.svg',
  'azure/monitor': '/assets/icons/management/monitor.svg',
  'azure/log-analytics': '/assets/icons/analytics/log-analytics-workspaces.svg',
  'azure/api-management': '/assets/icons/devops/api-management-services.svg',
  'azure/event-grid': '/assets/icons/menu/azure-event-grid-v2-0-topics.svg',
  'azure/resource-group': '/assets/icons/general/resource-groups.svg',
  'k8s/deploy': '/assets/icons/k8s/deploy.svg',
  'k8s/svc': '/assets/icons/k8s/svc.svg',
  'k8s/sa': '/assets/icons/k8s/sa.svg',
  'k8s/ns': '/assets/icons/k8s/ns.svg',
  'k8s/hpa': '/assets/icons/k8s/hpa.svg',
  'k8s/pod': '/assets/icons/k8s/pod.svg',
  'k8s/ing': '/assets/icons/k8s/ing.svg',
  'k8s/secret': '/assets/icons/k8s/secret.svg',
  'k8s/pvc': '/assets/icons/k8s/pvc.svg',
  'k8s/cm': '/assets/icons/k8s/cm.svg',
  'k8s/crd': '/assets/icons/k8s/crd.svg',
  'k8s/job': '/assets/icons/k8s/job.svg',
  'k8s/sts': '/assets/icons/k8s/sts.svg',
  'k8s/ds': '/assets/icons/k8s/ds.svg',
  'k8s/netpol': '/assets/icons/k8s/netpol.svg',
  'k8s/gateway': '/assets/icons/k8s/gateway.svg',
  'k8s/httproute': '/assets/icons/k8s/httproute.svg',
  'k8s/pdb': '/assets/icons/k8s/pdb.svg',
  'k8s/vpa': '/assets/icons/k8s/vpa.svg',
  'k8s/cronjob': '/assets/icons/k8s/cronjob.svg',
  'k8s/role': '/assets/icons/k8s/role.svg',
  'k8s/rb': '/assets/icons/k8s/rb.svg',
  'k8s/deviceclass': '/assets/icons/k8s/deviceclass.svg',
  'k8s/resourceclaim': '/assets/icons/k8s/resourceclaim.svg',
  'k8s/resourceclaimtemplate': '/assets/icons/k8s/resourceclaimtemplate.svg',
  'k8s/resourceslice': '/assets/icons/k8s/resourceslice.svg',
  'k8s/inferencepool': '/assets/icons/k8s/inferencepool.svg',
  'k8s/inferenceobjective': '/assets/icons/k8s/inferenceobjective.svg',
  'k8s/endpointpicker': '/assets/icons/k8s/endpointpicker.svg',
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
