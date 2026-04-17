import { describe, it, expect } from 'vitest';
import { validateManifestsTool, staticValidateManifest } from './validate-manifests.js';

const VALID_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/my-app:1.0.0
          resources:
            limits:
              cpu: 500m
              memory: 256Mi
            requests:
              cpu: 100m
              memory: 128Mi
`.trim();

const PRIVILEGED_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
          securityContext:
            privileged: true
`.trim();

const LATEST_TAG_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:latest
`.trim();

const HOSTPATH_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      volumes:
        - name: host-data
          hostPath:
            path: /etc
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
`.trim();

const HOSTNETWORK_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
`.trim();

describe('validate-manifests static checks', () => {
  it('tool is registered with correct name', () => {
    expect(validateManifestsTool.name).toBe('aks.validate_manifests');
  });

  it('valid manifest has no errors for pinned image', () => {
    const diagnostics = staticValidateManifest(VALID_DEPLOYMENT);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('detects privileged: true as error', () => {
    const diagnostics = staticValidateManifest(PRIVILEGED_DEPLOYMENT);
    const errors = diagnostics.filter(
      (d) => d.severity === 'error' && d.message.includes('privileged')
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('detects :latest tag as warning', () => {
    const diagnostics = staticValidateManifest(LATEST_TAG_DEPLOYMENT);
    const warnings = diagnostics.filter(
      (d) => d.severity === 'warning' && d.message.includes('latest')
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('detects hostPath volume as error', () => {
    const diagnostics = staticValidateManifest(HOSTPATH_DEPLOYMENT);
    const errors = diagnostics.filter(
      (d) => d.severity === 'error' && d.message.includes('hostPath')
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('detects hostNetwork: true as error', () => {
    const diagnostics = staticValidateManifest(HOSTNETWORK_DEPLOYMENT);
    const errors = diagnostics.filter(
      (d) => d.severity === 'error' && d.message.includes('hostNetwork')
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('manifest missing apiVersion is invalid', () => {
    const diagnostics = staticValidateManifest('kind: Deployment\nmetadata:\n  name: test');
    const errors = diagnostics.filter(
      (d) => d.severity === 'error' && d.message.includes('apiVersion')
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
