export interface GenKaitoCrdInput {
  plan: {
    name: string;
  };
  proposed_services: {
    vmSize: string;
    model: string;
  };
}

export interface GenKaitoCrdOutput {
  content: string;
  outputPath: 'kaito-workspace.yaml';
}

const NAME_RE = /^[a-zA-Z0-9-]+$/;

export function genKaitoCrd(input: GenKaitoCrdInput): GenKaitoCrdOutput {
  if (!NAME_RE.test(input.plan.name)) {
    throw new Error(`gen_kaito_crd: plan.name must match /^[a-zA-Z0-9-]+$/, got: ${JSON.stringify(input.plan.name)}`);
  }
  const { vmSize, model } = input.proposed_services;
  if (!vmSize) {
    throw new Error('gen_kaito_crd: proposed_services.vmSize must be a non-empty string');
  }
  if (!model) {
    throw new Error('gen_kaito_crd: proposed_services.model must be a non-empty string');
  }

  const { name } = input.plan;
  const content = [
    'apiVersion: kaito.sh/v1alpha1',
    'kind: Workspace',
    'metadata:',
    `  name: ${name}-workspace`,
    'spec:',
    '  resource:',
    `    instanceType: ${vmSize}`,
    '    labelSelector:',
    '      matchLabels:',
    `        app: ${name}`,
    '  inference:',
    '    preset:',
    `      name: ${model}`,
  ].join('\n') + '\n';

  return { content, outputPath: 'kaito-workspace.yaml' };
}
