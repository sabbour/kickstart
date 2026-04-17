import React from 'react';
import type { Artifact } from '@kickstart/harness';

interface ArtifactContextValue {
  artifacts: Artifact[];
  getArtifact: (path: string) => Artifact | undefined;
}

const ArtifactContext = React.createContext<ArtifactContextValue>({
  artifacts: [],
  getArtifact: () => undefined,
});

export function useArtifacts(): ArtifactContextValue {
  return React.useContext(ArtifactContext);
}

export const ArtifactProvider = ArtifactContext.Provider;
