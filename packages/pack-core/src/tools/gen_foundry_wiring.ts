export interface GenFoundryWiringInput {
  plan: {
    name: string;
  };
  proposed_services: Record<string, unknown>;
}

export interface GenFoundryWiringOutput {
  content: string;
  outputPath: 'foundry-secret.yaml';
}

const NAME_RE = /^[a-zA-Z0-9-]+$/;

export function genFoundryWiring(input: GenFoundryWiringInput): GenFoundryWiringOutput {
  if (!NAME_RE.test(input.plan.name)) {
    throw new Error(`gen_foundry_wiring: plan.name must match /^[a-zA-Z0-9-]+$/, got: ${JSON.stringify(input.plan.name)}`);
  }

  const { name } = input.plan;
  const content = [
    'apiVersion: v1',
    'kind: Secret',
    'metadata:',
    `  name: ${name}-foundry-secrets`,
    'type: Opaque',
    'stringData:',
    '  AZURE_OPENAI_ENDPOINT: "{{ secrets.AZURE_OPENAI_ENDPOINT }}"',
    '  AZURE_OPENAI_KEY: "{{ secrets.AZURE_OPENAI_KEY }}"',
    '  AZURE_AI_FOUNDRY_PROJECT: "{{ secrets.AZURE_AI_FOUNDRY_PROJECT }}"',
  ].join('\n') + '\n';

  return { content, outputPath: 'foundry-secret.yaml' };
}
