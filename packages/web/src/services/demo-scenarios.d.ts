import type { DemoResponse } from '../types';
import type { VirtualFileSystem } from './virtual-fs';
export declare function getDemoResponse(userMessage: string): DemoResponse;
export declare function resetDemoState(): void;
/**
 * Populate the VirtualFileSystem with demo files, simulating a staggered
 * generation effect. Each file appears as "generating" then flips to "complete".
 */
export declare function populateDemoFiles(fs: VirtualFileSystem): void;
/** Check whether the current demo turn is the file-generation phase. */
export declare function isDemoFileGenerationPhase(): boolean;
//# sourceMappingURL=demo-scenarios.d.ts.map