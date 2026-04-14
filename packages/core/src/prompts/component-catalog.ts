/**
 * @module @kickstart/core/prompts/component-catalog
 *
 * Dynamic A2UI component catalog for system prompt injection.
 * Generates the section 5 "A2UI COMPONENT CATALOG" section from structured
 * catalog entries rather than hardcoded prompt text.
 *
 * Components from IntegrationKit registrations are merged with the base
 * catalog at buildSystemPrompt() time, so adding a new component to
 * the registry automatically documents it in the prompt.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category grouping for prompt rendering. */
export type ComponentCategory =
  | "layout"
  | "content"
  | "input"
  | "domain";

/**
 * A catalog entry carries the metadata needed to render one component's
 * documentation line in the system prompt.
 */
export interface ComponentCatalogEntry {
  /** A2UI component type identifier, e.g. "Row", "Button" */
  type: string;
  /** Category for grouping in the prompt */
  category: ComponentCategory;
  /** JSON example string shown to the LLM */
  example: string;
  /** Optional notes appended after the example (e.g. variant lists) */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Base catalog -- the 28 core Kickstart components
// ---------------------------------------------------------------------------

export const BASE_COMPONENT_CATALOG: readonly ComponentCatalogEntry[] = [
  // -- Layout ---------------------------------------------------------------
  {
    type: "Row",
    category: "layout",
    example: '{"id":"r1","component":"Row","children":["a","b"],"gap":"8px","justify":"spaceBetween","wrap":true}',
  },
  {
    type: "Column",
    category: "layout",
    example: '{"id":"c1","component":"Column","children":["a","b"],"gap":"16px"}',
  },
  {
    type: "List",
    category: "layout",
    example: '{"id":"l1","component":"List","children":["i1","i2"],"ordered":false}',
  },
  {
    type: "Card",
    category: "layout",
    example: '{"id":"card1","component":"Card","children":["title","body"]}',
  },
  {
    type: "Tabs",
    category: "layout",
    example: '{"id":"tabs1","component":"Tabs","tabs":[{"label":"Overview","children":["ov1"]},{"label":"Details","children":["d1"]}]}',
  },
  {
    type: "Divider",
    category: "layout",
    example: '{"id":"div1","component":"Divider"}',
  },
  {
    type: "Modal",
    category: "layout",
    example: '{"id":"m1","component":"Modal","child":"content","title":"Confirm","open":false}',
  },
  {
    type: "Accordion",
    category: "layout",
    example: '{"id":"acc1","component":"Accordion","items":[{"title":"What is auto-scaling?","children":["acc-body1"]},{"title":"How do health checks work?","children":["acc-body2"]}],"collapsible":true,"multiple":true}',
  },

  // -- Content --------------------------------------------------------------
  {
    type: "Text",
    category: "content",
    example: '{"id":"t1","component":"Text","text":"Hello World","variant":"h1"}',
    notes: "variants: h1, h2, h3, body, caption, code",
  },
  {
    type: "Markdown",
    category: "content",
    example: '{"id":"md1","component":"Markdown","content":"### Features\\\\n- Auto-scaling\\\\n- Health checks\\\\n- Zero-downtime deploys"}',
  },
  {
    type: "Image",
    category: "content",
    example: '{"id":"img1","component":"Image","src":"https://...","alt":"diagram"}',
  },
  {
    type: "Icon",
    category: "content",
    example: '{"id":"ic1","component":"Icon","name":"check-circle","size":"24px"}',
  },
  {
    type: "Badge",
    category: "content",
    example: '{"id":"b1","component":"Badge","text":"Recommended","color":"success","appearance":"filled"}',
    notes: "colors: brand, danger, important, informative, severe, subtle, success, warning",
  },

  // -- Input ----------------------------------------------------------------
  {
    type: "Button",
    category: "input",
    example: '{"id":"btn1","component":"Button","label":"Select Node.js","variant":"primary","action":{"event":{"name":"select","context":{"label":"Select Node.js","value":"node"}}}}',
    notes: 'Variants: primary, secondary, outline, danger, ghost. Use "label" for inline text.',
  },
  {
    type: "TextField",
    category: "input",
    example: '{"id":"tf1","component":"TextField","label":"App Name","placeholder":"my-app","action":{"event":{"name":"set-name","context":{"label":"App Name"}}}}',
  },
  {
    type: "CheckBox",
    category: "input",
    example: '{"id":"cb1","component":"CheckBox","label":"Enable auto-scaling","action":{"event":{"name":"toggle","context":{"label":"Enable auto-scaling"}}}}',
  },
  {
    type: "ChoicePicker",
    category: "input",
    example: '{"id":"cp1","component":"ChoicePicker","label":"Runtime","options":[{"label":"Node.js","value":"node"},{"label":"Python","value":"python"},{"label":".NET","value":"dotnet"},{"label":"Java","value":"java"},{"label":"Go","value":"go"}],"action":{"event":{"name":"pick-runtime","context":{"label":"Runtime"}}}}',
  },
  {
    type: "RadioGroup",
    category: "input",
    example: '{"id":"rg1","component":"RadioGroup","label":"Database","options":[{"label":"PostgreSQL","value":"postgres","description":"Best for relational data"},{"label":"Cosmos DB","value":"cosmos","description":"Best for document/NoSQL data","recommended":true}],"action":{"event":{"name":"pick-db","context":{"label":"Database"}}}}',
  },
  {
    type: "Slider",
    category: "input",
    example: '{"id":"s1","component":"Slider","label":"Replicas","min":1,"max":10,"value":2,"action":{"event":{"name":"set-replicas","context":{"label":"Replicas"}}}}',
  },
  {
    type: "Toggle",
    category: "input",
    example: '{"id":"tog1","component":"Toggle","label":"Enable public URL","checked":false}',
  },
  {
    type: "ComboBox",
    category: "input",
    example: '{"id":"cb1","component":"ComboBox","label":"Azure Region","options":[{"text":"East US","value":"eastus"},{"text":"West Europe","value":"westeurope"}],"placeholder":"Search regions...","allowCustom":false}',
  },
  {
    type: "MultiSelect",
    category: "input",
    example: '{"id":"ms1","component":"MultiSelect","label":"Features","options":[{"text":"Auto-scaling","value":"autoscale"},{"text":"Health checks","value":"health"},{"text":"CI/CD pipeline","value":"cicd"}],"placeholder":"Select features..."}',
  },
  {
    type: "DateTimeInput",
    category: "input",
    example: '{"id":"dt1","component":"DateTimeInput","label":"Deploy after","value":"2025-01-01T09:00:00Z"}',
  },

  // -- Domain ---------------------------------------------------------------
  {
    type: "CostEstimate",
    category: "domain",
    example: '{"id":"cost1","component":"CostEstimate","items":[{"name":"App Platform","sku":"Standard","monthlyCost":116.80},{"name":"Database","sku":"PostgreSQL B1ms","monthlyCost":12.40}],"total":129.20,"currency":"USD"}',
  },
  {
    type: "ArchitectureDiagram",
    category: "domain",
    example: '{"id":"arch1","component":"ArchitectureDiagram","nodes":[{"id":"api","label":"Web API","type":"compute"},{"id":"db","label":"PostgreSQL","type":"database"}],"edges":[{"from":"api","to":"db"}]}',
    notes: "Node types: compute, database, cache, network, storage, ai, messaging",
  },
  {
    type: "FileEditor",
    category: "domain",
    example: '{"id":"fe1","component":"FileEditor","filename":"Dockerfile","language":"dockerfile","content":"FROM node:20-alpine\\\\nWORKDIR /app\\\\nCOPY . .\\\\nRUN npm ci\\\\nCMD [\\\\"node\\\\",\\\\"server.js\\\\"]"}',
  },
  {
    type: "AuthCard",
    category: "domain",
    example: '{"id":"auth1","component":"AuthCard","provider":"azure","title":"Sign in to Azure","description":"Connect your Azure account to deploy"}',
  },
  {
    type: "DeploymentProgress",
    category: "domain",
    example: '{"id":"dp1","component":"DeploymentProgress","steps":[{"id":"s1","label":"Build image","status":"complete"},{"id":"s2","label":"Push to registry","status":"running"},{"id":"s3","label":"Deploy","status":"pending"}]}',
  },
];

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: "Layout Components",
  content: "Content Components",
  input: "Input Components",
  domain: "Kickstart Domain Components",
};

const CATEGORY_ORDER: readonly ComponentCategory[] = [
  "layout",
  "content",
  "input",
  "domain",
];

// ---------------------------------------------------------------------------
// Catalog section generator
// ---------------------------------------------------------------------------

/**
 * Format a single catalog entry as a prompt line.
 * Output: `- TypeName: {"id":...}` with optional trailing notes.
 */
function formatEntry(entry: ComponentCatalogEntry): string {
  const line = `- ${entry.type}: ${entry.example}`;
  return entry.notes ? `${line}\n  ${entry.notes}` : line;
}

/**
 * Generate the section 5 "A2UI COMPONENT CATALOG" section of the system prompt
 * from a set of catalog entries.
 *
 * @param baseCatalog   The built-in Kickstart component entries
 * @param kitEntries    Additional entries contributed by IntegrationKits
 * @returns The complete markdown section ready for prompt injection
 */
export function generateComponentCatalogSection(
  baseCatalog: readonly ComponentCatalogEntry[] = BASE_COMPONENT_CATALOG,
  kitEntries: readonly ComponentCatalogEntry[] = [],
): string {
  // Merge base + kit entries, deduplicating by type (kit wins on conflict)
  const entryMap = new Map<string, ComponentCatalogEntry>();
  for (const entry of baseCatalog) {
    entryMap.set(entry.type, entry);
  }
  for (const entry of kitEntries) {
    entryMap.set(entry.type, entry);
  }

  const allEntries = Array.from(entryMap.values());
  const totalCount = allEntries.length;

  // Group by category
  const groups = new Map<ComponentCategory, ComponentCatalogEntry[]>();
  for (const entry of allEntries) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }

  // Build the section
  const lines: string[] = [
    `## 5. A2UI COMPONENT CATALOG`,
    "",
    `You have ${totalCount} components. Use them aggressively \u2014 every turn should use 3-8 components for a rich experience.`,
    "",
  ];

  for (const category of CATEGORY_ORDER) {
    const entries = groups.get(category);
    if (!entries?.length) continue;
    lines.push(`### ${CATEGORY_LABELS[category]}`);
    for (const entry of entries) {
      lines.push(formatEntry(entry));
    }
    lines.push("");
  }

  // Handle any kit-contributed categories not in the standard order
  for (const [category, entries] of groups) {
    if ((CATEGORY_ORDER as readonly string[]).includes(category)) continue;
    lines.push(`### ${CATEGORY_LABELS[category] ?? category}`);
    for (const entry of entries) {
      lines.push(formatEntry(entry));
    }
    lines.push("");
  }

  return lines.join("\n");
}
