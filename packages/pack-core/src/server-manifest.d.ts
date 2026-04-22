/**
 * Server-safe pack manifest for `corePack` — no JSX imports.
 *
 * This file is intentionally separate from core-pack.ts so that server-side
 * code (Azure Functions) can import the pack without pulling in React or
 * Fluent UI dependencies.
 *
 * Component property schemas are provided for the 22 basic components sourced
 * from the a2ui catalog. The 5 Fluent-only overrides (Badge, Accordion, Toggle,
 * ComboBox, MultiSelect) and the 13 rich components use z.unknown() as a
 * placeholder schema.
 *
 * TODO: Extract rich component schemas to a shared non-JSX file so the server
 * can serve accurate JSON schemas for all 40 components.
 */
import type { Pack } from '@aks-kickstart/harness';
export declare const corePackServer: Pack;
//# sourceMappingURL=server-manifest.d.ts.map