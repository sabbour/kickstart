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
