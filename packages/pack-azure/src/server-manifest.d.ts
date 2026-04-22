/**
 * Server-safe pack manifest for `azurePack` — no JSX imports.
 *
 * Mirrors `pack-core/src/server-manifest.ts`: tools, user actions, and
 * guardrails are imported directly because they are plain TypeScript with
 * no React dependency. Component contributions are listed by name with
 * placeholder schemas so the server can expose the catalog over
 * `/api/packs` without pulling Fluent UI or React into the Azure Functions
 * bundle.
 *
 * TODO: Extract component schemas from the `.tsx` files into shared
 * non-JSX modules so the server can serve accurate JSON schemas.
 */
import type { Pack } from '@aks-kickstart/harness';
export declare const azurePackServer: Pack;
//# sourceMappingURL=server-manifest.d.ts.map