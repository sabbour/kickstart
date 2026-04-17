---
name: generate-plan
description: Guides the orchestrator in producing a complete, structured deployment plan from user requirements. Covers required sections, quality criteria, and how to handle ambiguous inputs.
version: 0.1.0
x-kickstart:
  appliesTo:
    - core.orchestrator
  keywords:
    - plan
    - generate
    - kickstart
  priority: 80
---

## Generating a Kickstart Deployment Plan

When the user has provided enough context to proceed, produce a deployment plan using the structure below. A plan is **complete** when all required sections are present and non-empty.

### Required sections

```
## App Summary
Brief description of the application, runtime, and framework.

## Target Environment
- Cloud: Azure
- Platform: AKS Automatic (default) or AKS Standard
- Region: <user-specified or recommended>

## Azure Resources
- Subscription: <subscription ID or "user will provide">
- Resource Group: <name>
- AKS Cluster: <name>
- Azure Container Registry: <name> (if needed)
- Managed Identity: <name>

## Container Image Strategy
Either:
- Use existing image: <registry/image:tag>
- Build from source: Dockerfile at <path>; push to <ACR name>

## GitHub Repository
- Repo: <org/repo>
- Default branch: <branch>
- CI/CD: GitHub Actions workflow at .github/workflows/deploy.yml

## Kubernetes Workload
- Name: <workload name>
- Replicas: <initial count>
- CPU request/limit: <m>/<m>
- Memory request/limit: <Mi>/<Mi>
- Port: <containerPort>

## Cost Estimate (placeholder)
- AKS system node pool: TBD
- Compute (user workload): TBD
- Container Registry: TBD
- Egress: TBD
```

### Quality criteria

Before writing the plan, verify:
1. The application type is identified (web service, batch job, daemon, etc.).
2. The user's scale expectations are captured (expected RPS, peak load, SLA).
3. Any existing Azure resources the user wants to reuse are noted.
4. The GitHub repository is specified or the user has agreed to create one.

### Handling ambiguity

If any required field is missing:
- Ask a single, specific question to fill the gap — do not ask multiple questions at once.
- Provide a sensible default and offer to proceed with it: "I'll use `eastus` as the region unless you prefer another — shall I proceed?"
- Never invent subscription IDs, resource names, or image tags.

### After writing the plan

Tell the user: "Here's the deployment plan I've drafted. Review it and let me know if anything needs adjusting. Once you're happy, I'll kick off the architecture review."
