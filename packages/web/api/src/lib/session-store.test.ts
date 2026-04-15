import { describe, expect, it } from "vitest";
import { Phase } from "@kickstart/core";
import {
  createSession,
  extractArtifactsFromA2UI,
  hydrateSession,
} from "./session-store.js";

describe("session-store phase hydration", () => {
  it("starts new sessions in discover", () => {
    const session = createSession("principal-123");
    expect(session.engineState.currentPhase).toBe(Phase.Discover);
    expect(session.state.currentPhase).toBe(Phase.Discover);
    expect(session.routingPhaseTrusted).toBe(true);
  });

  it("rehydrates the current phase from client history", () => {
    const session = hydrateSession([
      { role: "assistant", content: "Architecture approved", phase: Phase.Design },
      { role: "assistant", content: "Files generated", phase: Phase.Generate },
      { role: "assistant", content: "Cost reviewed", phase: Phase.Review },
      { role: "assistant", content: "Repo selected", phase: Phase.Handoff },
      { role: "assistant", content: "Ready to deploy", phase: Phase.Deploy },
    ], "principal-123");

    expect(session.engineState.currentPhase).toBe(Phase.Deploy);
    expect(session.state.currentPhase).toBe(Phase.Deploy);
    expect(session.routingPhaseTrusted).toBe(false);
    expect(session.engineState.phaseStatus[Phase.Discover]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Design]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Generate]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Review]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Handoff]).toBe("complete");
    expect(session.engineState.phaseStatus[Phase.Deploy]).toBe("active");
  });

  it("falls back to discover when the client history has no usable phase", () => {
    const session = hydrateSession([
      { role: "assistant", content: "Hello there", phase: "unknown-phase" },
      { role: "user", content: "continue" },
    ], "principal-123");

    expect(session.engineState.currentPhase).toBe(Phase.Discover);
    expect(session.state.currentPhase).toBe(Phase.Discover);
    expect(session.routingPhaseTrusted).toBe(false);
  });

  it("rehydrates generated artifacts from compact assistant A2UI payloads", () => {
    const session = hydrateSession([
      {
        role: "assistant",
        content: "Generated the next batch of files.",
        phase: Phase.Generate,
        a2uiMessages: [
          {
            version: "v0.9",
            updateComponents: {
              surfaceId: "msg-1",
              components: [
                {
                  id: "editor",
                  component: "FileEditor",
                  files: [
                    {
                      artifactPath: "artifacts/Dockerfile",
                    },
                    {
                      path: "infra/main.bicep",
                      content: "resource app 'Microsoft.App/containerApps@2024-03-01' = {}",
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ], "principal-123");

    expect(session.generatedArtifacts).toEqual([
      {
        filename: "artifacts/Dockerfile",
        language: "dockerfile",
        bicepResources: [],
        k8sResources: [],
      },
      {
        filename: "infra/main.bicep",
        language: "bicep",
        bicepResources: ["app (Microsoft.App/containerApps)"],
        k8sResources: [],
      },
    ]);
  });

  it("rehydrates trusted setup generation snapshots from client history", () => {
    const session = hydrateSession([
      {
        role: "assistant",
        content: "Setup generation paused on Dockerfile.",
        phase: Phase.Generate,
        setupGeneration: {
          run: {
            runId: "run-1",
            phase: "generate",
            currentStepIndex: 1,
            steps: [
              { id: "app-scaffolding", label: "App scaffolding", required: false, status: "skipped" },
              { id: "dockerfile", label: "Dockerfile", required: true, status: "error" },
              { id: "deployment-config", label: "Deployment config", required: true, status: "pending" },
              { id: "ci-cd", label: "CI/CD", required: true, status: "pending" },
              { id: "service-connections", label: "Service connections", required: false, status: "skipped" },
            ],
            status: "paused",
            generatedFiles: [
              {
                stepId: "dockerfile",
                path: "Dockerfile",
                language: "dockerfile",
                byteLength: 42,
                sha256: "abc123",
              },
            ],
            totalBytes: 42,
            updatedAt: "2026-04-16T00:00:00.000Z",
            lastError: {
              stepId: "dockerfile",
              code: "codex_error",
              message: "Retry the current step.",
              recoverable: true,
              occurredAt: "2026-04-16T00:00:00.000Z",
            },
          },
        },
      },
    ], "principal-123");

    expect(session.setupGenerationTrusted).toBe(true);
    expect(session.setupGenerationRun).toMatchObject({
      runId: "run-1",
      currentStepIndex: 1,
      status: "paused",
      totalBytes: 42,
      generatedFiles: [
        expect.objectContaining({
          path: "Dockerfile",
          language: "dockerfile",
        }),
      ],
    });
    expect(session.generatedArtifacts).toEqual([
      {
        filename: "Dockerfile",
        language: "dockerfile",
        bicepResources: [],
        k8sResources: [],
      },
    ]);
  });

  it("rejects invalid setup generation snapshots from client history", () => {
    const session = hydrateSession([
      {
        role: "assistant",
        content: "Setup generation paused on Dockerfile.",
        phase: Phase.Generate,
        setupGeneration: {
          run: {
            runId: "run-1",
            phase: "generate",
            currentStepIndex: 1,
            steps: [
              { id: "dockerfile", label: "Dockerfile", required: true, status: "error" },
            ],
            status: "totally-invalid",
            generatedFiles: [],
            totalBytes: 0,
            updatedAt: "2026-04-16T00:00:00.000Z",
          },
        },
      },
    ], "principal-123");

    expect(session.setupGenerationTrusted).toBe(false);
    expect(session.setupGenerationRun).toBeUndefined();
    expect(session.generatedArtifacts).toEqual([]);
  });
});

describe("extractArtifactsFromA2UI", () => {
  it("extracts artifact metadata from single-file and multi-file payloads", () => {
    const artifacts = extractArtifactsFromA2UI([
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "msg-1",
          components: [
            {
              id: "file-1",
              component: "FileEditor",
              filename: "k8s/deployment.yaml",
              content: "kind: Deployment\nmetadata:\n  name: api\n",
            },
            {
              id: "file-2",
              component: "FileEditor",
              files: [
                {
                  path: "src/index.ts",
                  content: "console.log('hi')",
                },
                {
                  artifactPath: "artifacts/Dockerfile",
                },
              ],
            },
          ],
        },
      },
    ]);

    expect(artifacts).toEqual([
      {
        filename: "k8s/deployment.yaml",
        language: "yaml",
        bicepResources: [],
        k8sResources: ["Deployment: api"],
      },
      {
        filename: "src/index.ts",
        language: "typescript",
        bicepResources: [],
        k8sResources: [],
      },
      {
        filename: "artifacts/Dockerfile",
        language: "dockerfile",
        bicepResources: [],
        k8sResources: [],
      },
    ]);
  });
});
