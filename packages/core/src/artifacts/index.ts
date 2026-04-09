/**
 * @module @kickstart/core/artifacts
 *
 * Artifact store — persists generated files (K8s manifests, Dockerfiles,
 * GitHub Actions workflows, Bicep templates) so they can be read, exported,
 * and downloaded by the user.
 */

export type { Artifact, ArtifactStore } from "./types.js";
export { InMemoryArtifactStore, defaultArtifactStore } from "./in-memory.js";
