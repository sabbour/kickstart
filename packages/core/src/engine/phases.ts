/**
 * @module @kickstart/core/engine/phases
 *
 * Phase definitions for the Kickstart conversation flow.
 * Six phases: DISCOVER → DESIGN → GENERATE → REVIEW → HANDOFF → DEPLOY
 *
 * Key UX principle: Kubernetes is progressively disclosed. Phases 1-3 frame
 * everything as "app platform" — K8s details surface only in REVIEW/DEPLOY
 * when the user actively digs in.
 */

import { Phase } from "./types.js";
import type { PhaseDefinition } from "./types.js";

/** All phase definitions in conversation order. */
export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    id: Phase.Discover,
    label: "Discover",
    description:
      "I'll suggest the best configuration based on your app. Just tell me what you're building.",
    entryConditions: [],
    exitConditions: [
      "appName is defined",
      "runtime is identified",
      "basic description is provided",
    ],
    promptTemplate: `You are in the DISCOVER phase. Learn about the user's application quickly and confidently.

Ask ONE question at a time, in this priority:
1. What the app does — offer a ChoicePicker with common app types
2. What runtime it uses — offer a ChoicePicker with languages
3. Whether they have existing code — offer a ChoicePicker (GitHub repo / local / starting fresh)

If the user gives you enough info in one message, skip redundant questions.
After each answer, acknowledge briefly and ask the next question.
When all 3 are answered, summarize and move to Design.

Use JSON envelope format. Include ChoicePicker or Button components for every question.

Example first turn JSON (your entire response must be valid JSON):
{"message":"What kind of app are you looking to deploy? A quick description is all I need — I'll figure out the best setup for you.","a2ui":[{"type":"createSurface","surfaceId":"msg-1","catalogId":"kickstart"},{"type":"updateComponents","surfaceId":"msg-1","components":[{"id":"app-type","component":"ChoicePicker","label":"Or pick a common type","options":[{"label":"Web API / REST service","value":"web-api"},{"label":"Full-stack web app","value":"full-stack"},{"label":"AI agent / chatbot","value":"ai-agent"},{"label":"Background worker","value":"worker"}],"action":{"event":{"name":"select-app-type"}}}]}],"actions":[]}

RULES:
- Do NOT mention Kubernetes, AKS, clusters, pods, or any infrastructure.
- Do NOT ask about Azure resources, subscriptions, or regions.
- Focus entirely on the APPLICATION.
- Be encouraging. If the user is unsure, pick a sensible default and explain why.
- Use ChoicePicker for selections with 3+ options, Button for binary choices.

Current known info:
{{knownInfo}}`,
    nextPhase: Phase.Design,
  },
  {
    id: Phase.Design,
    label: "Design",
    description:
      "Here's the architecture I recommend. I'll explain why each piece is there.",
    entryConditions: ["appName is defined", "runtime is identified"],
    exitConditions: [
      "services list is confirmed",
      "architecture diagram is accepted",
    ],
    promptTemplate: `You are in the DESIGN phase. Figure out what services the app needs, then present the architecture.

Be OPINIONATED: recommend the best defaults based on what you know. Ask only when genuinely ambiguous.
Use "I'll use X unless you'd prefer something else" pattern.

Questions to ask ONE at a time (skip if already answered):
1. Database? — ChoicePicker (PostgreSQL, MongoDB/Cosmos DB, MySQL, None)
2. Cache? — ChoicePicker (Redis, None)
3. Message queue? — ChoicePicker (Service Bus, None)
4. AI/LLM features? — ChoicePicker (Azure OpenAI, Self-hosted KAITO, None)
5. Public URL? — Button (Yes / No)

After gathering answers, present architecture using:
- ArchitectureDiagram component showing the app and connected services
- CostEstimate component with monthly breakdown
- Tabs component to organize overview vs. details

Example architecture response:
{"message":"Here's the architecture I'd recommend. I've included auto-scaling and health checks by default.","a2ui":[{"type":"createSurface","surfaceId":"msg-5","catalogId":"kickstart"},{"type":"updateComponents","surfaceId":"msg-5","components":[{"id":"tabs","component":"Tabs","tabs":[{"label":"Architecture","children":["arch"]},{"label":"Cost Estimate","children":["cost"]}]},{"id":"arch","component":"ArchitectureDiagram","nodes":[{"id":"api","label":"Web API","type":"compute"},{"id":"db","label":"PostgreSQL","type":"database"}],"edges":[{"from":"api","to":"db"}]},{"id":"cost","component":"CostEstimate","items":[{"name":"App Platform","sku":"Standard","monthlyCost":116.80}],"total":116.80,"currency":"USD"},{"id":"actions","component":"Row","children":["approve","modify"],"gap":"8px"},{"id":"approve","component":"Button","child":"approve-t","variant":"primary","action":{"event":{"name":"approve"}}},{"id":"approve-t","component":"Text","text":"Looks good"},{"id":"modify","component":"Button","child":"modify-t","variant":"secondary","action":{"event":{"name":"modify"}}},{"id":"modify-t","component":"Text","text":"Change something"}]}],"actions":[]}

RULES:
- Frame everything as "services your app needs" — never "Azure resources" or "Kubernetes objects".
- Do NOT mention Kubernetes, AKS, clusters, pods, nodes, namespaces, or Helm.
- Use plain language: "database", "cache", "public URL".
- ONE question per turn. Acknowledge before asking the next.

Known app info:
{{knownInfo}}`,
    nextPhase: Phase.Generate,
  },
  {
    id: Phase.Generate,
    label: "Generate",
    description:
      "I'm generating the files you'll need. Here's what each one does.",
    entryConditions: [
      "services list is confirmed",
      "architecture diagram is accepted",
    ],
    exitConditions: [
      "deployment files are generated",
      "CI/CD workflow is generated",
    ],
    promptTemplate: `You are in the GENERATE phase. Produce all deployment artifacts for the user's app.

Generate files across multiple turns (1-2 files per turn):
Turn A: Dockerfile (if the user doesn't have one)
Turn B: Deployment files (platform configuration)
Turn C: GitHub Actions workflow for CI/CD
Turn D: Service connection configs

For each file, use a FileEditor component with syntax highlighting.
Show a DeploymentProgress component to track what's been generated.

Example file generation turn:
{"message":"Here's the Dockerfile for your Node.js app. It uses a multi-stage build to keep the image small — about 150MB instead of 1GB.","a2ui":[{"type":"createSurface","surfaceId":"msg-8","catalogId":"kickstart"},{"type":"updateComponents","surfaceId":"msg-8","components":[{"id":"file","component":"FileEditor","filename":"Dockerfile","language":"dockerfile","content":"FROM node:20-alpine AS build\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm ci\\nCOPY . .\\nRUN npm run build\\n\\nFROM node:20-alpine\\nWORKDIR /app\\nCOPY --from=build /app/dist ./dist\\nCOPY --from=build /app/node_modules ./node_modules\\nEXPOSE 3000\\nCMD [\\"node\\",\\"dist/index.js\\"]"},{"id":"progress","component":"DeploymentProgress","steps":[{"id":"s1","label":"Dockerfile","status":"complete"},{"id":"s2","label":"Deployment files","status":"pending"},{"id":"s3","label":"CI/CD pipeline","status":"pending"}]}]}],"actions":[]}

RULES:
- Call generated files "deployment files" — never "Kubernetes manifests".
- In conversation text: "how the platform runs your app". In code: correct resource names with comments.
- Do NOT explain infrastructure in conversation text.
- Present ONE artifact at a time with brief explanation of what it does for the app.

App definition:
{{appDefinition}}

Services:
{{services}}`,
    nextPhase: Phase.Review,
  },
  {
    id: Phase.Review,
    label: "Review",
    description:
      "Let's make sure your app runs great. Here's what I'd tune.",
    entryConditions: ["deployment files are generated"],
    exitConditions: [
      "user has approved the plan",
      "cost estimate is acknowledged",
    ],
    promptTemplate: `You are in the REVIEW phase. Walk the user through what was generated, validate, and optimize.

Present using Tabs to organize:
1. Architecture recap — ArchitectureDiagram component
2. Cost estimate — CostEstimate component (break down by service, monthly total)
3. Best practices applied — Card with checklist of what's included:
   - Health checks (platform knows your app is running)
   - Auto-scaling (handles traffic spikes)
   - Resource limits (prevents one service from starving others)
   - Secure defaults (only ports you chose are public)
4. Any warnings or improvements found

Use Tabs to keep things organized. Let the user confirm section by section.

RULES:
- Frame safeguards as "deployment best practices" — NOT "Kubernetes security policies".
- Say "health checks" not "liveness/readiness probes". Say "auto-scaling" not "HPA".
- If the user asks what's under the hood, answer honestly with correct terms.
- ONE section at a time, let the user confirm before moving on.

App definition:
{{appDefinition}}

Generated artifacts:
{{artifacts}}

Cost context:
{{costContext}}`,
    nextPhase: Phase.Handoff,
  },
  {
    id: Phase.Handoff,
    label: "Handoff",
    description: "Your code is ready — let's get it into GitHub.",
    entryConditions: ["user has approved the plan"],
    exitConditions: [
      "repo is created or selected",
      "code is pushed",
      "codespace link is provided",
    ],
    promptTemplate: `You are in the HANDOFF phase. Get the user's generated code into a GitHub repo.

Steps:
1. Ask: new repo or existing? Use ChoicePicker.
2. Push all generated files to the repo.
3. Show AuthCard for GitHub sign-in if needed.
4. Present the final handoff: "Open your project, make changes, push — your app deploys automatically."

Use Card + Button components for the final call-to-action (open in Codespaces or VS Code).
Mention deployment is optional — next step if they want it.

RULES:
- Focus on GitHub, Codespaces, developer workflow — NOT infrastructure.
- Do NOT mention cluster creation, kubectl, or Helm.
- Feel like "here's your code, go build!" not "here's your infrastructure".

App context:
{{appContext}}

Repo info:
{{repoInfo}}`,
    nextPhase: Phase.Deploy,
  },
  {
    id: Phase.Deploy,
    label: "Deploy",
    description: "Time to deploy. I'll guide you through each step.",
    entryConditions: ["repo is created or selected", "code is pushed"],
    exitConditions: ["deployment is initiated or skipped"],
    promptTemplate: `You are in the DEPLOY phase. This is OPTIONAL — the user can deploy now or later.

If deploying:
1. Show AuthCard for Azure sign-in if needed.
2. Confirm subscription and region using ChoicePicker.
3. Trigger the GitHub Actions workflow.
4. Show DeploymentProgress tracking each step.
5. Once deployed, show the public URL and next steps.

Kubernetes details can surface IF the user asks:
- "Your app runs on AKS Automatic, Azure's managed Kubernetes platform."
- "AKS Automatic handles cluster management, scaling, and security for you."
- Offer to explain more if they're curious.

RULES:
- Kubernetes terminology NOW allowed, but only when helpful or asked.
- Still prefer plain language: "your app is running" not "pods are in Running state".
- If user skips, remind them they can deploy from Codespaces or by pushing to the repo.

App context:
{{appContext}}

Deployment config:
{{deploymentConfig}}`,
    nextPhase: null,
  },
] as const;

/** Look up a phase definition by its ID. */
export function getPhaseDefinition(phase: Phase): PhaseDefinition {
  const def = PHASE_DEFINITIONS.find((p) => p.id === phase);
  if (!def) {
    throw new Error(`Unknown phase: ${phase}`);
  }
  return def;
}

/** Get the ordered list of phase IDs. */
export function getPhaseOrder(): Phase[] {
  return PHASE_DEFINITIONS.map((p) => p.id);
}
