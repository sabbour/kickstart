---
sidebar_position: 1
---

# Welcome to Kickstart

**Kickstart** gets your application running on [AKS Automatic](https://learn.microsoft.com/azure/aks/intro-aks-automatic) through a conversation — no Kubernetes expertise required.

You describe your app. Kickstart asks the right questions, proposes an architecture, generates production-ready Dockerfiles and manifests, and walks you through deployment — all inside an interactive chat interface.

## How it works in 60 seconds

1. **Tell Kickstart about your app** — language, framework, ports, any dependencies
2. **Review the proposed architecture** — the agent designs an AKS Automatic setup suited to your inputs
3. **Inspect generated artifacts** — Dockerfile, Kubernetes manifests, GitHub Actions workflow
4. **Deploy** — the agent executes the deployment against your cluster and surfaces any errors

That's it. The conversation is the pipeline.

## What makes this different

**No blank YAML.** You never write a Kubernetes manifest from scratch. Every artifact is generated from your conversation context and presented for review before anything is applied.

**Progressive disclosure.** Kubernetes concepts appear only when relevant. In the early phases your app is just "an application to deploy" — complexity surfaces gradually as you approach the Deploy phase.

**Structured AI output.** Kickstart is built on [A2UI v0.9](https://learn.microsoft.com/), an open protocol that lets the AI render interactive cards, progress bars, code blocks, and forms directly inside the chat thread — not just plain text.

**Purpose-built for AKS Automatic.** [AKS Automatic](https://learn.microsoft.com/azure/aks/intro-aks-automatic) manages nodes, scaling, patching, and monitoring for you. Kickstart is designed around its constraints and capabilities.

## Where to go next

| Goal | Link |
|------|------|
| Run Kickstart locally | [Local Setup](/docs/getting-started/local-setup) |
| Understand key concepts | [Core Concepts](/docs/core-concepts) |
| Add a pack or tool | [Pack Authoring Guide](/docs/pack-authoring) |
| Understand the internals | [Architecture Overview](/docs/architecture/overview) |
| Contribute to the project | [Contributing](/docs/contributing) |
