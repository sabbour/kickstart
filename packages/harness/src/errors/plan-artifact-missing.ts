export class PlanArtifactMissing extends Error {
  readonly code = 'HARNESS_E001' as const;
  readonly phase: 'triage-to-architect' | 'architect-to-codesmith';

  constructor(phase: 'triage-to-architect' | 'architect-to-codesmith') {
    super('Plan artifact is missing — please re-approve');
    this.name = 'PlanArtifactMissing';
    this.phase = phase;
  }
}
