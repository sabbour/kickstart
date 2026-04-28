# Component Selection Framework

**Status:** Phase 1 Documentation | **Scope:** All agents across all packs

---

## Purpose

This document provides a decision framework for selecting UI components across all agent packs. It replaces ad-hoc, scenario-specific component choices with a principled, reasoned approach.

**Key outcomes:**
- Consistent component usage across agents (same use case = same component)
- Transparency: agents explain *why* they chose a component
- Extensibility: adding new components doesn't require rewriting agent logic
- Guidance for new components: clear decision tree for novel use cases

---

## Core Principle

**Choose based on discriminating factors, not scenario.** Don't ask "Is this a static site request?" → pick SummaryCard. Instead ask: "What am I displaying? How many items? How much structure? Is interactivity needed?"

---

## Component Taxonomy

### Display Components (inform the user)

These components present information in structured, readable formats.

#### 1. **SummaryCard**
- **Purpose:** Display 4-10 structured items (key-value pairs, fields, or grouped metadata)
- **When to use:**
  - Results from analysis (e.g., "5 Azure resources found", component audit results)
  - Structured metadata (e.g., deployment configuration, system info)
  - Read-only summaries (e.g., plan review, compliance checklist)
- **Complexity:** Low-to-Medium | **Interactivity:** None
- **Example:** Show detected tech stack (3-6 frameworks), deployment constraints
- **Don't use when:** >10 items (use ProgressSteps or SummaryList), needs editing, requires complex layout

**Anti-patterns:**
- ❌ Using SummaryCard for 15 items (too cramped; use ProgressSteps or custom layout)
- ❌ Displaying component recommendations without explanation (include reasoning)
- ❌ Mixing read-only fields with editable ones (pick one; use Questionnaire for editing)

---

#### 2. **ProgressSteps**
- **Purpose:** Visualize a phased workflow with 4-8 steps
- **When to use:**
  - Scaffolding (e.g., "Track selection → Requirements → Plan → Implementation")
  - Build workflows (e.g., "Scaffold → Generate → Validate → Publish")
  - Sequential guidance (e.g., "Step 1: Choose cluster topology. Step 2: Configure networking. Step 3: Deploy.")
  - Multi-phase deployments (e.g., "Pre-checks → Deploy infra → Deploy apps → Verify")
- **Complexity:** Medium | **Interactivity:** Navigation between steps
- **Example:** Show AKS cluster provisioning steps with current progress
- **Don't use when:** <3 steps (too simple; use prose + Button), >8 steps (too long; split into phases), no clear sequencing

**Anti-patterns:**
- ❌ Using ProgressSteps for a single choice (use ButtonGroup instead)
- ❌ Using ProgressSteps for 12 items (too many; break into sub-phases)
- ❌ Incomplete steps (each step should have a clear action or outcome)

---

#### 3. **Markdown**
- **Purpose:** Formatted text with headings, lists, code blocks, and links
- **When to use:**
  - Explanations with structure (e.g., architecture rationale, deployment plan)
  - Code or configuration display (e.g., generated Dockerfile preview)
  - Long-form guidance (e.g., "Here's how to troubleshoot...")
  - Mixed formatting (bullet lists, code snippets, emphasis)
- **Complexity:** Low | **Interactivity:** Links only
- **Example:** Plan document with alternatives discussed, code examples
- **Don't use when:** Only prose (use natural language response), no code/structure needed

**Anti-patterns:**
- ❌ Wall of Markdown without breaks (use SummaryCard for structured data)
- ❌ Markdown for single choice presentation (use ButtonGroup instead)
- ❌ Including large codebases (>100 lines; link or summarize instead)

---

### Selection Components (ask the user to choose)

These components let users pick from a set of options.

#### 4. **ButtonGroup**
- **Purpose:** Select 1 item from 2-4 options
- **When to use:**
  - Binary decisions (Yes/No, Approve/Reject, Continue/Cancel)
  - Quick selections (Build / Review / Deploy, Track choice when 2-3 tracks match)
  - Action choices (e.g., "Want to deploy now?" Yes/No)
- **Complexity:** Low | **Interactivity:** Click to select
- **Example:** "Deploy to staging or production?" / "Use Bicep or ARM template?"
- **Don't use when:** >4 options (use RadioGroup), option descriptions needed, multi-select

**Anti-patterns:**
- ❌ 6+ options in ButtonGroup (use RadioGroup instead)
- ❌ No clear default (ButtonGroup should have a natural default)
- ❌ Options that need explanation (use RadioGroup with descriptions)

---

#### 5. **RadioGroup** (aka TrackPicker when specialized)
- **Purpose:** Select 1 item from 5-8 options with descriptions
- **When to use:**
  - Multiple app tracks (Static Site / Containerized Web / Agentic AI / Repo Uplift)
  - Backend selection (KAITO / Foundry / Generic Endpoint)
  - Inference options (models with descriptions, e.g., GPT-4 vs. Mistral)
  - Complex choices where explanation helps
- **Complexity:** Medium | **Interactivity:** Click + descriptions visible
- **Example:** TrackPicker with 4 app types, each with 1-line description
- **Don't use when:** <3 options (use ButtonGroup), >8 options (overwhelming), multi-select needed

**Anti-patterns:**
- ❌ 2 options (use ButtonGroup instead)
- ❌ No descriptions (at least 1 line per option explaining benefit/use case)
- ❌ 10+ options (user paralysis; group or limit to top 5)

---

#### 6. **Questionnaire**
- **Purpose:** Collect structured data via a form
- **When to use:**
  - Multi-field input (e.g., deployment config: region, registry, secrets)
  - Dependent fields (e.g., "Pick VPC type" → then "Pick subnets for that VPC")
  - Validation needed (e.g., "Enter valid email", "Port must be 1-65535")
  - Batch constraints (e.g., collect all cloud settings at once)
- **Complexity:** Medium-to-High | **Interactivity:** Type, select, validate, submit
- **Example:** "Configure deployment: (Region dropdown, SKU dropdown, optional storage account name)"
- **Don't use when:** <3 fields (ask prose questions), >10 fields (too overwhelming; break into phases), single text input (ask prose)

**Anti-patterns:**
- ❌ Using Questionnaire for a single yes/no (use ButtonGroup or prose question)
- ❌ 15+ fields in one form (split into ProgressSteps phases or multi-turn prose)
- ❌ Collecting optional fields that aren't needed (minimize required fields)
- ❌ No default values (pre-populate sensible defaults when possible)

---

### Specialized Components

#### 7. **ArchitectureDiagram**
- **Purpose:** Visual representation of infrastructure design
- **When to use:**
  - AKS cluster topology (nodes, node pools, networking)
  - Azure resource architecture (VNets, subnets, NSGs, services)
  - Data flow diagrams (e.g., "User → App → DB → Cache")
  - High-level system design (when visual > prose)
- **Complexity:** High | **Interactivity:** Pan/zoom, click for details
- **Example:** AKS cluster with 3 node pools, system namespace, app deployments
- **Don't use when:** Simple design (prose suffices), <3 components (too sparse), user hasn't approved design yet (get buy-in first)

**Anti-patterns:**
- ❌ Diagram before design is finalized (use Markdown plan first, then diagram once approved)
- ❌ Overly detailed diagram (show layers: compute, networking, storage; too much detail → separate diagrams)
- ❌ No legend (unclear what shapes/colors mean)

---

#### 8. **EnvironmentVariablesGrid**
- **Purpose:** Display or edit environment variables in a table
- **When to use:**
  - Configuration management (show vars to set before deployment)
  - Secrets inventory (e.g., "These secrets must be set in Key Vault")
  - Feature flags (e.g., "These ENV vars control behavior")
- **Complexity:** Medium | **Interactivity:** Copy/edit cells
- **Example:** "Set these before deploying: AZURE_TENANT_ID, AZURE_CLIENT_ID, SECRET_KEY"
- **Don't use when:** <3 variables (list in prose), >20 variables (use docs instead), no context needed

**Anti-patterns:**
- ❌ Displaying plain variable names without hints (include descriptions)
- ❌ Mixing required + optional without clear marking (use "Required" / "Optional" labels)

---

#### 9. **CustomCodeBlock** / **FilePreview**
- **Purpose:** Show generated or sample code
- **When to use:**
  - Preview generated Dockerfile before creating
  - Sample configuration (e.g., Bicep template structure)
  - Inline code snippets (e.g., copy-paste examples)
- **Complexity:** Low | **Interactivity:** Copy to clipboard
- **Example:** "Here's the Dockerfile we'll generate: [code preview]"
- **Don't use when:** Prose explanation suffices, file is >200 lines (link instead)

**Anti-patterns:**
- ❌ Showing entire generated file (show summary + offer to see full file later)
- ❌ No syntax highlighting (use language tags)

---

#### 10. **Card** / **SummaryList**
- **Purpose:** Generic container for flexible content
- **When to use:**
  - When other components don't fit (fallback)
  - Custom layouts needed
  - Multiple related items in a scrollable list
- **Complexity:** Variable | **Interactivity:** Custom
- **Example:** List of Azure resources with actions (view, update, delete)
- **Don't use when:** SummaryCard, ProgressSteps, or another component fits better

**Anti-patterns:**
- ❌ Using Card as a catch-all (always try specific components first)

---

## Decision Tree

Use this tree to select a component for a given scenario:

```
What are you trying to do?

├─ DISPLAY information?
│  ├─ Structured data (4-10 items)? → SummaryCard
│  ├─ Phased workflow (4-8 steps)? → ProgressSteps
│  ├─ Complex formatting (code, lists)? → Markdown
│  ├─ Infrastructure diagram? → ArchitectureDiagram
│  └─ Environment variables? → EnvironmentVariablesGrid
│
├─ ASK user to CHOOSE one option?
│  ├─ 2-4 simple options? → ButtonGroup
│  ├─ 5-8 options with descriptions? → RadioGroup / TrackPicker
│  └─ Complex multi-option choice? → Use prose + RadioGroup
│
├─ COLLECT multi-field input?
│  ├─ 3+ related fields? → Questionnaire
│  └─ 1-2 fields? → Prose question (ask and wait for response)
│
└─ PREVIEW generated code/config?
   └─ CustomCodeBlock / FilePreview
```

---

## Examples by Scenario

### Scenario 1: First-turn app type selection

**User says:** "I want to build an AI chatbot."

**Analysis:**
- Discriminating question: "What app type?"
- Options available: 4 tracks (Static Site, Containerized Web, Agentic AI, Repo Uplift)
- Match: "Agentic AI" is primary match (keyword "AI chatbot")

**Decision:**
- 1 track matches clearly → **Route directly, no UI needed**
- If 2-3 tracks matched → **Use RadioGroup (TrackPicker)** with descriptions
- If ambiguous (0 or 4+ matches) → **Use prose question** ("What kind of app?") then show options

**Component choice:** None (direct route) or RadioGroup (if ambiguous)

---

### Scenario 2: Deployment requirements

**User says:** "Deploy to Azure. We use OIDC for identity."

**Analysis:**
- Information needed: Region, registry, secrets, oidc config, cluster topology
- Complexity: 5+ related fields
- Dependency: "Pick cluster type" → if AKS, show node pool fields

**Decision:**
- 5+ dependent fields → **Use Questionnaire**
- Pre-populate sensible defaults (e.g., region = user's current region)
- Include validation (e.g., port must be 1-65535)

**Component choice:** Questionnaire

---

### Scenario 3: Plan review

**User wants to review generated deployment plan before proceeding.**

**Analysis:**
- Goal: Show plan details (infrastructure, phases, decisions, rationale)
- Content: 3-5 decision points + 20+ lines of explanation
- Interaction: Yes/No approval

**Decision:**
- Show plan in Markdown (formatted, with code blocks)
- Ask approval via ButtonGroup (Approve / Request Changes)

**Component choice:** Markdown + ButtonGroup

---

### Scenario 4: AKS cluster design

**Agent is proposing an AKS cluster topology for a mission-critical app.**

**Analysis:**
- Goal: Visualize cluster design (3 node pools, system namespace, ingress controller)
- Content: Infrastructure diagram
- Interaction: User should approve before deployment

**Decision:**
- Draft design in Markdown (architecture rationale, node pool rationale)
- Show ArchitectureDiagram (visual of topology)
- Ask approval via ButtonGroup (Approve / Revise)

**Component choice:** Markdown + ArchitectureDiagram + ButtonGroup

---

### Scenario 5: Configuration validation

**Agent is showing environment variables that must be set.**

**Analysis:**
- Goal: Display required + optional env vars
- Content: 10+ variables with descriptions
- Interaction: Copy to clipboard, or mark as "done"

**Decision:**
- Use EnvironmentVariablesGrid (structured table, easy to copy)
- Or Markdown (if <5 variables and prose suffices)

**Component choice:** EnvironmentVariablesGrid or Markdown

---

## Anti-Patterns & Pitfalls

### ❌ Anti-Pattern 1: "Choose all available components"
**Bad:** Agent emits ButtonGroup + Questionnaire + ProgressSteps + SummaryCard all at once.

**Why it's bad:** User is overwhelmed; unclear what action they should take next.

**Fix:** Use exactly 1 component per turn (or 1 component + supporting Markdown). Let the user respond before showing the next component.

---

### ❌ Anti-Pattern 2: "SummaryCard for everything"
**Bad:** Agent shows deployment config (15 fields) in SummaryCard (read-only).

**Why it's bad:** SummaryCard is for 4-10 items; 15 fields are cramped. User can't edit values.

**Fix:** Use Questionnaire for 5+ editable fields, or Markdown for read-only reference.

---

### ❌ Anti-Pattern 3: "No prose + UI combo"
**Bad:** Agent emits ProgressSteps with no explanation of what each step does.

**Why it's bad:** User doesn't understand the workflow; feels prescriptive ("railway").

**Fix:** Always pair UI with Markdown explanation. Example: "Here's the deployment workflow: (Markdown explaining each phase) → (ProgressSteps showing progress)".

---

### ❌ Anti-Pattern 4: "Diagram before design"
**Bad:** Agent generates ArchitectureDiagram before discussing AKS topology with the user.

**Why it's bad:** Diagram embeds decisions (node pools, networking) before user approves.

**Fix:** First phase: Markdown discussion + acceptance. Second phase: Diagram visualization.

---

### ❌ Anti-Pattern 5: "Questionnaire with >10 fields"
**Bad:** Deployment Questionnaire has 15 fields (all required or optional).

**Why it's bad:** User paralysis; too many decisions at once.

**Fix:** Use ProgressSteps to break into phases. Phase 1: basic config (3 fields). Phase 2: advanced config (5 fields).

---

## Tool: Component Recommendation

When an agent is unsure which component to use, call `core.get_component_recommendation(use_case: string)`:

```
use_case: "display infrastructure design"
→ { recommended: "ArchitectureDiagram", reasoning: "..." }

use_case: "select from 4 app types"
→ { recommended: "RadioGroup", reasoning: "..." }

use_case: "collect 5 deployment fields"
→ { recommended: "Questionnaire", reasoning: "..." }
```

This tool returns the recommended component + reasoning, so agents can explain their choice to users.

---

## Governance & Evolution

### Adding a New Component

If you design a new component, follow this checklist:

- [ ] Define purpose in 1 sentence ("Display ___" or "Collect ___")
- [ ] List 3-5 scenarios where it's the right choice
- [ ] List 3-5 anti-patterns (when NOT to use it)
- [ ] Add to Component Taxonomy above
- [ ] Add decision tree node
- [ ] Provide 1 worked example
- [ ] Update `core.get_component_recommendation()` tool
- [ ] Document in agent prompts (e.g., "Use FooComponent when ___")

### Changing Component Behavior

If you change how a component works (e.g., ProgressSteps now supports 12 steps instead of 8):

- [ ] Update the "Don't use when" section here
- [ ] Audit existing agent uses (grep for that component in .agent.md files)
- [ ] Verify they still match the new guidance
- [ ] Update `core.get_component_recommendation()` if thresholds changed
- [ ] Add migration note to CHANGELOG

---

## Success Criteria

This framework is successful when:

- ✅ All agents use this decision tree before selecting a component
- ✅ Component choices are consistent (same use case → same component across agents)
- ✅ Agents include reasoning when emitting a component ("I chose RadioGroup because ___")
- ✅ Adding new components requires no agent prompt changes (tool-driven)
- ✅ New agents can reference this framework instead of hardcoding choices

---

## Next Steps

1. **Audit existing agent behavior** — grep for component usage in all .agent.md files; verify they match this framework
2. **Integrate with refactored agent prompts** — Phase 2 agents will reference this framework
3. **Build `core.get_component_recommendation()` tool** — Phase 3 infrastructure
4. **Team review** — Phase 1 consensus checkpoint

