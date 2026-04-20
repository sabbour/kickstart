# Kickstart Copilot Skills — Quick Reference

This directory contains **Copilot-level skills** — foundational process knowledge that @copilot and agents use when building and maintaining the Kickstart repo.

## 🎯 Core Maintenance Skills

These four skills cover the main workflows for maintaining this repository:

### 1. **Create A2UI Component** (`create-a2ui-component/SKILL.md`)
**When:** Adding a new reusable UI component to the design system  
**What:** The 4-layer stack (React component → frontend catalog → backend validator → LLM prompt)  
**Scope:** Presentational components, controlled by the LLM  
**Confidence:** high

### 2. **Create Smart Component** (`create-smart-component/SKILL.md`)
**When:** Creating a stateful component with business logic (validation, auth, API calls)  
**What:** Dual-layer pattern (smart component + A2UI wrapper)  
**Scope:** Components with state, local validation, side effects  
**Confidence:** high

### 3. **Create a New Pack** (`create-new-pack/SKILL.md`)
**When:** Adding a new domain-specific module to Kickstart  
**What:** Package structure, metadata, exports, build config  
**Scope:** Full packs (agents, skills, tools, components, manifests)  
**Confidence:** high

### 4. **Add a Skill to an Agent in a Pack** (`add-agent-skill/SKILL.md`)
**When:** Creating a reusable skill and registering it with an agent  
**What:** Skill authoring, charter registration, confidence levels  
**Scope:** Individual skills that teach agents patterns  
**Confidence:** high

---

## 📚 Other Skills in This Directory

The full skill set includes community-maintained and team-specific skills:

| Skill | Purpose |
|-------|---------|
| **agent-collaboration** | Cross-agent handoff patterns |
| **agent-conduct** | Agent code of conduct |
| **architectural-proposals** | How to propose and review architecture |
| **ci-validation-gates** | CI/CD testing and approval workflow |
| **cli-wiring** | Connecting CLI commands to agents |
| **client-compatibility** | Multi-client support (CLI, VS Code, GitHub.com) |
| **component-authoring** | General component writing (see specific skills above) |
| **cross-squad** | Working with external teams |
| **distributed-mesh** | Multi-agent coordination |
| **docs-standards** | Documentation conventions |
| **economy-mode** | Cost-effective agent operations |
| **error-recovery** | Handling and recovering from errors |
| **external-comms** | Communication with external services |
| **gh-auth-isolation** | GitHub authentication patterns |
| **git-workflow** | Git branching and commit conventions |
| **github-multi-account** | Multi-account GitHub workflows |
| **history-hygiene** | Agent memory management |
| **humanizer** | Friendly, human-centered language |
| **init-mode** | Squad team initialization |
| **model-selection** | Choosing the right AI model per task |
| **nap** | Idle/sleep behavior for agents |
| **personal-squad** | Personal agent teams |
| **project-conventions** | Kickstart-specific conventions |
| **release-process** | Semantic versioning and release workflow |
| **reskill** | Updating agent capabilities |
| **reviewer-protocol** | Code review gates and feedback |
| **secret-handling** | Managing credentials safely |
| **session-recovery** | Multi-session continuity |
| **squad-conventions** | Squad team patterns |
| **test-discipline** | Testing practices |
| **windows-compatibility** | Windows-specific workarounds |

---

## 🚀 How Agents Use These Skills

When @copilot or any agent is spawned, they automatically load and read relevant skills from `.copilot/skills/`. Skills appear in the agent's context and guide their work.

**Skill discovery:** Agents search by keyword or by agent name. For example:
- "I need to add a component" → finds `create-a2ui-component` or `create-smart-component`
- "I need to create a pack" → finds `create-new-pack`
- "I need to add a skill" → finds `add-agent-skill`

**Skill application:** When an agent applies a skill, they mention it by name and follow the step-by-step guidance in the SKILL.md file.

---

## 📝 Contributing

To add a new skill:

1. Create a directory: `.copilot/skills/{skill-name}/`
2. Write `SKILL.md` with YAML frontmatter + markdown content
3. Use **kebab-case** for skill names
4. Start confidence at `low`, bump to `medium`/`high` after validation
5. Include concrete examples agents can follow

See `add-agent-skill/SKILL.md` for the full authoring pattern.

---

## 🔗 Quick Links

- **Kickstart docs:** https://sabbour.me/kickstart/
- **GitHub repo:** https://github.com/sabbour/kickstart
- **Development guide:** See `DEVELOPMENT.md` in the repo root
- **Contributing guide:** See `CONTRIBUTING.md` in the repo root
