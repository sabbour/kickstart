/**
 * @module @kickstart/core/generators/kubernetes
 *
 * Generates Kubernetes manifests (Deployment, Service, Ingress)
 * from an AppDefinition and AzureContext.
 */

import type { GeneratorInput, GeneratorOutput } from "./types.js";

/**
 * Generate Kubernetes manifests for deploying the app to AKS.
 *
 * @param input - Application and Azure context
 * @returns Generated K8s manifest files
 *
 * @remarks
 * Phase 1 stub — generates basic Deployment + Service + optional Ingress.
 * Future: HPA, PDB, NetworkPolicy, Secrets via CSI driver.
 */
export function generateKubernetesManifests(
  input: GeneratorInput,
): GeneratorOutput {
  const { app, azure } = input;
  const namespace = app.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${namespace}
  namespace: ${namespace}
  labels:
    app: ${namespace}
spec:
  replicas: ${app.resourceTier === "production" ? 3 : 1}
  selector:
    matchLabels:
      app: ${namespace}
  template:
    metadata:
      labels:
        app: ${namespace}
    spec:
      containers:
        - name: ${namespace}
          image: <IMAGE_PLACEHOLDER>
          ports:
            - containerPort: ${app.port}
          env:
${app.envVars.map((v) => `            - name: ${v}\n              value: ""`).join("\n") || "            []"}
          resources:
            requests:
              cpu: "${app.resourceTier === "production" ? "500m" : "100m"}"
              memory: "${app.resourceTier === "production" ? "512Mi" : "128Mi"}"
            limits:
              cpu: "${app.resourceTier === "production" ? "1000m" : "250m"}"
              memory: "${app.resourceTier === "production" ? "1Gi" : "256Mi"}"
`;

  const service = `apiVersion: v1
kind: Service
metadata:
  name: ${namespace}
  namespace: ${namespace}
spec:
  selector:
    app: ${namespace}
  ports:
    - port: 80
      targetPort: ${app.port}
  type: ClusterIP
`;

  const files = [
    { path: "k8s/deployment.yaml", content: deployment, language: "yaml" },
    { path: "k8s/service.yaml", content: service, language: "yaml" },
  ];

  if (app.needsIngress) {
    const ingress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${namespace}
  namespace: ${namespace}
  annotations:
    kubernetes.io/ingress.class: webapprouting.kubernetes.azure.com
spec:
  rules:
    - host: ${app.customDomain || `${namespace}.${azure.region}.cloudapp.azure.com`}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${namespace}
                port:
                  number: 80
`;
    files.push({ path: "k8s/ingress.yaml", content: ingress, language: "yaml" });
  }

  return {
    generator: "kubernetes",
    files,
    summary: `Generated ${files.length} Kubernetes manifests for ${app.name} (${app.runtime}, tier: ${app.resourceTier})`,
  };
}
