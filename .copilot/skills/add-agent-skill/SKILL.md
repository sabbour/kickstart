# Add a Skill to an Agent in a Pack

**Confidence:** high  
**Last updated:** 2026-04-20  
**Use when:** Creating a new skill module and registering it with an agent in a pack

## What is a Skill?

A **Skill** is a reusable, composable unit of expertise that an agent can invoke to accomplish tasks. Skills are defined as YAML frontmatter + markdown documentation, stored in pack subdirectories, and referenced by agents in their charters.

**Skill anatomy:**

```yaml
---
name: skill-name
description: Short description of what this skill teaches
version: 0.1.0
x-kickstart:
  appliesTo:
    - agent.name
  keywords:
    - keyword1
    - keyword2
  priority: 80  # 0-100; higher = more important
---

# Skill Title

What this skill teaches, when to use it, step-by-step instructions...
```

Skills live in `packages/pack-{name}/src/skills/{skill-name}/SKILL.md` and are registered in the agent's charter.

## Pattern: Skill Authoring → Agent Registration

```
Step 1: Write SKILL.md                        (document the expertise)
  ↓
Step 2: Register in agent charter             (teach agent when to use it)
  ↓
Step 3: Update pack metadata                  (register in server manifest)
  ↓
Step 4: Test the skill                        (verify agent applies it)
```

## Steps

### Step 1: Create the Skill File

Create file: `packages/pack-{name}/src/skills/{skill-name}/SKILL.md`

The file structure is **YAML frontmatter + markdown content**:

```yaml
---
name: your-skill-name
description: One-sentence description of what this skill teaches
version: 0.1.0
x-kickstart:
  appliesTo:
    - agent.name          # Which agent(s) use this skill
    - other.agent         # Can apply to multiple agents
  keywords:
    - keyword1
    - keyword2
    - keyword3
  priority: 80            # 0-100, higher = more important (used for skill ordering)
---

# Skill Name (matching the title case of name)

**When to use:** Brief statement of when the agent should apply this skill.

## The Pattern

[Explain the pattern — what the skill teaches, why it matters, what the agent should do]

Example structure:
- **Bad approach:** [what NOT to do and why]
- **Good approach:** [what TO do and step-by-step how]
- **Boundary conditions:** [edge cases, when the pattern breaks]

## Steps

1. [Step 1 — detailed with examples/code]
2. [Step 2 — detailed with examples/code]
3. [Step 3 — detailed with examples/code]

## Example

[Concrete, copy-paste-ready example the agent can follow]

## Anti-Patterns

[Common mistakes agents make when attempting this skill]

## References

- [Link to related docs]
- [Link to code examples in the repo]
```

**Example skill:**

```yaml
---
name: zod-schema-validation
description: How to design Zod schemas for strict LLM output validation
version: 0.1.0
x-kickstart:
  appliesTo:
    - core.codesmith
  keywords:
    - validation
    - zod
    - schema
    - a2ui
  priority: 85
---

# Zod Schema Validation

**When to use:** When designing the schema for an A2UI component or data structure that the LLM will emit.

## The Pattern

Always use `.strict()` on Zod schemas for LLM output. This rejects unknown properties and catches hallucinations early.

### Bad Approach

```ts
const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
});
```

The LLM might emit `{ name, email, secret_admin_field }` and the invalid field silently gets through.

### Good Approach

```ts
const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
}).strict();
```

Now if the LLM emits unknown fields, validation fails loudly.

## Steps

1. **Define required fields first** — use primitive Zod types (z.string, z.number, z.boolean)
2. **Mark optional fields** — append `.optional()` for anything that's not required
3. **Use discriminators** — for unions/discriminated unions, make the discriminator literal
4. **Add .strict()** — always, at the end
5. **Test invalid input** — verify the schema rejects hallucinations

## Example

```ts
const ComponentSchema = z.object({
  name: z.literal('UserCard'),      // Discriminator
  title: z.string(),                  // Required
  subtitle: z.string().optional(),    // Optional
  actions: z.array(z.object({
    label: z.string(),
    event: z.enum(['click', 'hover']),
  })).optional(),
}).strict();

// Test: this should FAIL
ComponentSchema.parse({
  name: 'UserCard',
  title: 'Hello',
  unknownField: 'should reject',  // ← validation error!
});
```

## Anti-Patterns

- **Don't use `.passthrough()`** — this silently accepts unknown fields
- **Don't chain multiple objects without .strict()** — intermediate objects leak validation
- **Don't skip the discriminator** — unions without discriminators are ambiguous

## References

- [Zod docs: discriminatedUnion](https://zod.dev/docs/unions#discriminated-unions)
- [A2UI schema validation in kickstart](https://github.com/sabbour/kickstart/blob/main/packages/core/src/services/a2ui-schema.ts)
```

### Step 2: Register the Skill in the Agent's Charter

Edit the agent's charter file: `packages/pack-{name}/src/agents/{agent-name}.agent.md`

The charter lists which skills the agent knows:

```markdown
---
name: pack-name.agent-name
description: Agent description
model:
  envVar: KICKSTART_CHAT_MODEL
tools: []
handoffs: []
skills:
  - core.skill-name                   # Existing skills
  - {pack-name}.your-skill-name       # Your new skill
---

Agent description and instructions...
```

**How it works:** When the agent is spawned, it loads all skills from its charter. The skills appear in the agent's context — the agent can read them and apply them to its work.

### Step 3: Optionally Add to server-manifest.ts

Edit: `packages/pack-{name}/src/server-manifest.ts`

If you're building a new pack or maintaining the server manifest, add your skill:

```ts
export const manifest: ServerManifest = {
  agents: [],
  skills: [
    // ... existing skills
    { name: 'your-skill-name', path: '/skills/your-skill-name/SKILL.md' },
  ],
  tools: [],
  components: [],
};
```

Note: In practice, this manifest is often auto-generated during the build. Check the pack's build script to see if you need to update it manually.

### Step 4: Test the Skill

To verify the agent applies your skill:

1. **Manual test:** Spawn the agent and observe whether it follows the pattern (look at agent output)
2. **Skill verification checklist:**
   - [ ] Agent mentions the skill by name when applying it
   - [ ] Agent follows the step-by-step instructions in the skill
   - [ ] Agent calls out edge cases mentioned in the skill
   - [ ] Agent avoids the anti-patterns listed in the skill

## Skill Confidence Levels

Skills use a three-level confidence model that only goes up (never down):

| Level | When | How to bump |
|-------|------|-----------|
| `low` | First observation / initial capture | Agent notices a reusable pattern worth documenting |
| `medium` | Confirmed | Multiple agents or sessions independently apply the skill and it works |
| `high` | Established | Consistently applied across the team, well-tested, team-agreed |

**Bumping confidence:** When an agent independently applies your skill and it works, that's a confirmation worth noting. Update the skill's confidence in `SKILL.md`:

```yaml
# At the top of SKILL.md
**Confidence:** medium  # was low, bumped by codesmith successful application
```

## Writing a Good Skill

### Checklist:

- [ ] **Clear name** — kebab-case, describes the pattern (e.g., `zod-strict-validation`)
- [ ] **Clear description** — one sentence, says what the skill teaches
- [ ] **Concrete example** — copy-paste-ready, solves a real problem
- [ ] **Anti-patterns** — what NOT to do
- [ ] **Keywords** — tags so agents can find this skill
- [ ] **Version** — start at 0.1.0 (bump to 1.0.0 when confidence reaches high)
- [ ] **appliesTo** — list agents that should know this skill

### What Makes a Skill Reusable

A skill is **reusable** if:
1. Multiple agents might need it (not just one)
2. It solves a recurring problem across projects
3. It's independent of a specific codebase or project
4. It captures a pattern that can be applied in different contexts

**Example reusable skills:**
- "How to design Zod schemas for LLM validation" ✅
- "How to batch file writes efficiently" ✅
- "How to fetch and parse external documentation" ✅

**Example NOT reusable:**
- "How to add a button to UserCard component" ❌ (too specific)
- "How to call the Azure Storage API" ❌ (domain-specific, belongs in pack-azure)

## Files Modified

- `packages/pack-{name}/src/skills/{skill-name}/SKILL.md` (new)
- `packages/pack-{name}/src/agents/{agent-name}.agent.md` (edit: add skill to `skills` array)
- `packages/pack-{name}/src/server-manifest.ts` (optional edit, if using manual manifest)

## See Also

- [Create A2UI Component](#) — uses skills for component development patterns
- [Create New Pack](#) — skills belong inside packs
- [Kickstart skills reference](https://github.com/sabbour/kickstart/tree/main/packages/pack-core/src/skills) — see existing skills as examples
