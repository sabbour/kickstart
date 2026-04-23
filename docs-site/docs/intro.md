---
sidebar_position: 1
---

# What is Kickstart?

**Kickstart** is an AI-guided web application that helps developers deploy their applications to [Azure Kubernetes Service (AKS) Automatic](https://learn.microsoft.com/azure/aks/intro-aks-automatic) — without needing Kubernetes expertise.

Instead of writing YAML manifests and Dockerfiles from scratch, you have a conversation. Kickstart uses a conversational AI agent to gather your requirements, design your architecture, generate deployment artifacts, and execute deployments — all through a rich, interactive UI.

## Key Features

### Conversational AI Interface

Kickstart guides you through a multi-phase conversation:

1. **Discover** — understand your application (language, framework, dependencies)
2. **Design** — propose an architecture on AKS Automatic
3. **Generate** — create Dockerfiles, Kubernetes manifests, and GitHub Actions workflows
4. **Review** — let you inspect and edit every generated artifact
5. **Handoff** — prepare the deployment pipeline
6. **Deploy** — execute the deployment to AKS

### Rich UI with A2UI v0.9

Kickstart is built on **A2UI v0.9** (Agent-to-User Interface), an open protocol from Google for rendering structured AI output. The AI doesn't just return text — it renders interactive cards, forms, tabs, code blocks, and progress indicators inline in the conversation.

### Progressive Disclosure

The interface starts simple. You describe your app in plain language, and Kickstart reveals complexity only when needed. Kubernetes concepts are hidden until the later phases — your app is framed as deploying to an "app platform," not a container orchestrator.

### Real Deployment Artifacts

Kickstart generates production-ready files:

- **Dockerfile** — multi-stage build optimized for your runtime
- **Kubernetes manifests** — Deployments, Services, Ingress for AKS Automatic
- **GitHub Actions workflow** — CI/CD pipeline for build and deploy
- **Helm charts** (when appropriate)

### Targets AKS Automatic

[AKS Automatic](https://learn.microsoft.com/azure/aks/intro-aks-automatic) is Azure's fully managed Kubernetes offering. It handles node management, scaling, patching, and monitoring — so developers can focus on their application code. Kickstart is purpose-built for this experience.
