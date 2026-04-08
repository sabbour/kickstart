# Kickstart Architecture

This document describes the Kickstart system architecture — an AI-guided onboarding experience that helps developers deploy applications to AKS Automatic. Kickstart presents AKS as a "scalable app platform," hiding Kubernetes complexity until the Deploy phase.

## System Overview

Kickstart has two surfaces — a **web portal** and an **IDE integration** — both powered by a shared core engine.

```mermaid
graph TB
    Dev["👩‍💻 Developer"]

    subgraph "Web Surface"
        Browser["Browser"]
        SWA["Azure Static Web Apps"]
        API["Azure Functions API"]
    end

    subgraph "IDE Surface"
        IDE["VS Code / Claude Code"]
        MCPClient["MCP Client"]
        KickstartMCP["Kickstart MCP Server"]
    end

    subgraph "Shared Core — @kickstart/core"
        Engine["Conversation Engine"]
        Catalog["A2UI Catalog"]
        Prompts["Prompt System"]
        Generators["Code Generators"]
    end

    subgraph "External Services"
        AOAI["Azure OpenAI"]
        AzureMCP["Azure MCP Server"]
        AKSMCP["AKS MCP Server"]
        GitHubMCP["GitHub MCP Server"]
    end

    Dev --> Browser
    Dev --> IDE
    Browser --> SWA --> API
    API --> Engine
    API --> AOAI
    IDE --> MCPClient --> KickstartMCP
    KickstartMCP --> Engine
    KickstartMCP --> AzureMCP
    KickstartMCP --> AKSMCP
    KickstartMCP --> GitHubMCP
    Engine --> Prompts
    Engine --> Catalog
    Engine --> Generators
```

**Key insight:** When Kickstart hosts the experience (web), it provides the LLM (Azure OpenAI). When running as an MCP server (IDE), the user's own LLM handles inference.

---

## Web Surface Flow

The web surface runs as a static site on Azure Static Web Apps with an Azure Functions backend that proxies to Azure OpenAI.

```mermaid
sequenceDiagram
    participant User as Developer
    participant Browser
    participant SWA as Azure Static Web Apps
    participant API as Azure Functions API
    participant AOAI as Azure OpenAI
    participant Engine as Conversation Engine

    User->>Browser: Opens Kickstart portal
    Browser->>SWA: Load static assets (HTML/CSS/JS)
    SWA-->>Browser: Portal Prototyper chrome + Copilot panel

    User->>Browser: Types message in Copilot panel
    Browser->>API: POST /api/converse { message, phase, context }
    API->>Engine: Process conversation state
    Engine-->>API: Phase-specific prompt + context
    API->>AOAI: Chat completion request
    AOAI-->>API: Response with A2UI JSON
    API-->>Browser: { reply, a2ui_components[], phase }
    Browser->>Browser: Render A2UI components in DOM
```

---

## IDE Surface Flow

The IDE surface exposes Kickstart as an MCP server. It delegates infrastructure operations to specialized MCP servers for Azure, AKS, and GitHub.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant IDE as VS Code / Claude Code
    participant MCP as Kickstart MCP Server
    participant Engine as Conversation Engine
    participant AzMCP as Azure MCP Server
    participant AKSMCP as AKS MCP Server
    participant GHMCP as GitHub MCP Server

    Dev->>IDE: "Deploy my Node.js app"
    IDE->>MCP: tool/kickstart { message }
    MCP->>Engine: Advance conversation state
    Engine-->>MCP: Phase context + actions needed

    Note over MCP: Kickstart owns orchestration.<br/>Delegates infra operations.

    MCP->>AzMCP: Create resource group
    AzMCP-->>MCP: Resource group created
    MCP->>AKSMCP: Create AKS Automatic cluster
    AKSMCP-->>MCP: Cluster provisioned
    MCP->>GHMCP: Create repo + push manifests
    GHMCP-->>MCP: Repo ready, workflow triggered

    MCP-->>IDE: A2UI JSON response (rendered as MCP App)
    IDE-->>Dev: Shows progress + next steps
```

---

## Conversation Phases

Kickstart guides developers through 6 conversation phases. Kubernetes concepts are deliberately hidden until the Review phase — the user experience is "deploy an app," not "configure Kubernetes."

```mermaid
graph LR
    D["1️⃣ Discover"] --> De["2️⃣ Design"]
    De --> G["3️⃣ Generate"]
    G --> R["4️⃣ Review"]
    R --> H["5️⃣ Handoff"]
    H --> Dp["6️⃣ Deploy"]

    style D fill:#e1f5fe
    style De fill:#e1f5fe
    style G fill:#e1f5fe
    style R fill:#fff3e0
    style H fill:#fff3e0
    style Dp fill:#fff3e0
```

| Phase | Purpose | K8s Exposure |
|-------|---------|:---:|
| **Discover** | Understand the app — language, framework, ports, data stores | Hidden |
| **Design** | Architecture decisions — scaling, networking, storage | Hidden |
| **Generate** | Produce Dockerfiles, manifests, CI/CD pipelines | Hidden |
| **Review** | Validate generated artifacts, show K8s resources | Visible |
| **Handoff** | Push to GitHub, create PR, open Codespace | Visible |
| **Deploy** | Provision AKS Automatic, deploy workloads | Visible |

Phases 1–3 frame AKS Automatic as a "scalable app platform." Kubernetes terminology only surfaces in phases 4–6 when the developer reviews actual manifests.

---

## A2UI Rendering Pipeline

A2UI (Adaptive Application UI) is a JSON-based component schema. The LLM returns structured A2UI JSON, and each surface renders it natively.

```mermaid
flowchart LR
    LLM["LLM Response"] --> Parse["Parse A2UI JSON"]
    Parse --> Router{"Which surface?"}

    Router -->|Web| DOMRenderer["DOM Renderer<br/>(packages/web)"]
    Router -->|IDE| MCPApp["MCP App Renderer<br/>(packages/mcp-server)"]

    DOMRenderer --> WebUI["Portal-style UI<br/>in Copilot panel"]
    MCPApp --> IDEOutput["Inline IDE output<br/>(future: MCP App UI)"]

    subgraph "A2UI Catalog (17 components)"
        Standard["Standard (7)<br/>TextBlock, Image,<br/>ActionSubmit, etc."]
        Custom["Kickstart (6)<br/>AppSummary, ArchDiagram,<br/>DeployProgress, etc."]
        GitHub["GitHub (4)<br/>RepoPicker, WorkflowStatus,<br/>CodespaceLink, AppOverview"]
    end

    Parse -.->|validates against| Standard
    Parse -.->|validates against| Custom
    Parse -.->|validates against| GitHub
```

**Catalog ID:** `https://kickstart.aks.azure.com/catalog/v1/kickstart-catalog.json`

The catalog defines 17 components across three categories:
- **Standard (7):** Basic UI primitives — text, images, actions
- **Kickstart Custom (6):** Domain-specific — architecture diagrams, deploy progress, resource summaries
- **GitHub (4):** GitHub integration — repo pickers, workflow status, Codespace links, app overview

---

## Prompt Architecture

Kickstart uses a 3-layer prompt system. Higher layers are more specific and override lower layers as needed.

```mermaid
graph TB
    subgraph "Layer 3 — Phase-Specific Prompts"
        P1["Discover Prompt"]
        P2["Design Prompt"]
        P3["Generate Prompt"]
        P4["Review Prompt"]
        P5["Handoff Prompt"]
        P6["Deploy Prompt"]
    end

    subgraph "Layer 2 — System Prompt"
        Persona["Persona<br/>(Kickstart assistant)"]
        Safeguards["13 Deployment Safeguards<br/>(DS001 – DS013)"]
    end

    subgraph "Layer 1 — Azure Skills"
        AKS["AKS Automatic<br/>domain knowledge"]
        ACR["Container Registry<br/>patterns"]
        GHA["GitHub Actions<br/>CI/CD templates"]
        Net["Networking &<br/>DNS patterns"]
    end

    P1 & P2 & P3 & P4 & P5 & P6 -->|"override / extend"| Persona
    Persona --> AKS & ACR & GHA & Net
    Safeguards -->|"always enforced"| P1 & P2 & P3 & P4 & P5 & P6

    style Safeguards fill:#ffcdd2
```

**Layer composition at runtime:**
1. **Azure Skills** (Layer 1) are loaded per-phase — only relevant domain knowledge is injected
2. **System Prompt** (Layer 2) provides the Kickstart persona and enforces 13 deployment safeguards (DS001–DS013) across all phases
3. **Phase-Specific Prompts** (Layer 3) tailor the conversation for each phase's goals

The deployment safeguards (DS001–DS013) ensure generated infrastructure follows Azure best practices — things like enabling managed identity, enforcing HTTPS, setting resource limits, and using private endpoints.

---

## Deployment Architecture

```mermaid
flowchart TB
    subgraph "Source"
        Repo["GitHub Repository"]
    end

    subgraph "CI/CD"
        GHA["GitHub Actions"]
        DeployInfra["deploy-infra.yml<br/>(OIDC + Bicep)"]
        DeploySWA["deploy-swa.yml<br/>(packages/web → SWA)"]
    end

    subgraph "Azure (Web Surface)"
        SWA["Azure Static Web Apps"]
        Functions["Azure Functions<br/>(API backend)"]
        AOAI["Azure OpenAI"]
    end

    subgraph "npm (IDE Surface)"
        NPM["npm package<br/>@kickstart/mcp-server"]
        MCPConfig["MCP client config<br/>(VS Code / Claude Code)"]
    end

    Repo --> GHA
    GHA --> DeployInfra -->|"Bicep"| SWA
    GHA --> DeploySWA -->|"static files"| SWA
    SWA --> Functions --> AOAI

    Repo -->|"npm publish"| NPM
    NPM -->|"install + configure"| MCPConfig

    style SWA fill:#e8f5e9
    style NPM fill:#e3f2fd
```

| Target | Domain | Status |
|--------|--------|--------|
| Web (dev) | `kickstart.prototypes.aks.azure.sabbour.me` | Active |
| Web (production) | `kickstart.aks.azure.com` | Future |
| IDE | npm: `@kickstart/mcp-server` | In development |

---

## Monorepo Structure

```
kickstart/
├── packages/
│   ├── core/               @kickstart/core — shared engine
│   │   └── src/
│   │       ├── catalog/    A2UI component schemas (JSON Schema draft/2020-12)
│   │       ├── engine/     Conversation state machine + phase transitions
│   │       ├── generators/ Dockerfile, manifest, and CI/CD generators
│   │       ├── prompts/    3-layer prompt system
│   │       └── types.ts    Shared type contracts
│   ├── web/                @kickstart/web — portal frontend
│   │   ├── api/            Azure Functions (converse endpoint)
│   │   ├── js/             Client-side JS (config, auth, copilot panel)
│   │   ├── css/            Styles
│   │   └── index.html      Entry point
│   └── mcp-server/         @kickstart/mcp-server — IDE integration
│       └── src/
│           ├── tools/      MCP tool definitions
│           ├── a2ui.ts     A2UI response formatting
│           └── index.ts    Server entry point
├── infra/                  Bicep templates + setup scripts
├── docs/                   Architecture and documentation
└── package.json            Workspace root
```

Build order: `core` → `web/api` + `mcp-server` (core must build first due to project references).
