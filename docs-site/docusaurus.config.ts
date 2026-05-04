import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Kickstart',
  tagline: 'AI-guided onboarding for deploying apps to AKS',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://miniature-chainsaw-7p7mn8g.pages.github.io',
  baseUrl: '/',

  organizationName: 'azure-management-and-platforms',
  projectName: 'kickstart',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/azure-management-and-platforms/kickstart/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          // ADRs were removed from the published site (kept repo-internally at docs/adrs/).
          { from: '/docs/architecture/decisions/ADR-0001-per-role-github-apps', to: '/docs/architecture/overview' },
          { from: '/docs/architecture/decisions/ADR-0002-auth-error-ui-surface-on-retry', to: '/docs/architecture/overview' },
          { from: '/docs/architecture/decisions/ADR-0003-sdk-native-parallel-guardrails', to: '/docs/pack-authoring/guardrails' },
          { from: '/docs/architecture/decisions/ADR-0004-triage-mode-recognition-and-typed-handoff', to: '/docs/architecture/agent-coordination' },
          // Pre-restructure renames (v3 → v4, issue #441).
          { from: '/docs/architecture/v2-implementation-brief', to: '/docs/operations/browser-telemetry' },
          { from: '/docs/extending/integration-kits', to: '/docs/pack-authoring/packs' },
          { from: '/docs/architecture/agent-coordination-decisions', to: '/docs/architecture/agent-coordination' },
          // Wave 3: extending/* → pack-authoring/* and agent-authoring/*
          { from: '/docs/extending/overview', to: '/docs/pack-authoring' },
          { from: '/docs/extending/packs', to: '/docs/pack-authoring/packs' },
          { from: '/docs/extending/llm-tools', to: '/docs/pack-authoring/llm-tools' },
          { from: '/docs/extending/mcp-tools', to: '/docs/pack-authoring/mcp-tools' },
          { from: '/docs/extending/actions', to: '/docs/pack-authoring/actions' },
          { from: '/docs/extending/guardrails', to: '/docs/pack-authoring/guardrails' },
          { from: '/docs/extending/safeguards', to: '/docs/pack-authoring/safeguards' },
          { from: '/docs/extending/api-endpoints', to: '/docs/pack-authoring/api-endpoints' },
          { from: '/docs/extending/session-store', to: '/docs/pack-authoring/session-store' },
          { from: '/docs/extending/playground-scenarios', to: '/docs/pack-authoring/playground-scenarios' },
          { from: '/docs/extending/tools-reference', to: '/docs/pack-authoring/reference/tools' },
          { from: '/docs/extending/skills-reference', to: '/docs/pack-authoring/reference/skills' },
          { from: '/docs/extending/conversation-phases', to: '/docs/agent-authoring/conversation-phases' },
          { from: '/docs/extending/agent-as-tool', to: '/docs/agent-authoring/agent-as-tool' },
          { from: '/docs/extending/runner-chain', to: '/docs/agent-authoring/runner-chain' },
          { from: '/docs/extending/resume-and-session-token', to: '/docs/agent-authoring/resume-and-session-token' },
          // Wave 3: guides/* → pack-authoring/*
          { from: '/docs/guides/packs-and-skills', to: '/docs/pack-authoring/packs-and-skills' },
          { from: '/docs/guides/conversation-limits', to: '/docs/pack-authoring/conversation-limits' },
          // Wave 4: components/* redistributed
          { from: '/docs/components/custom-catalog', to: '/docs/pack-authoring/custom-catalog' },
          { from: '/docs/components/extending-a2ui', to: '/docs/architecture/extending-a2ui' },
          // Wave 2: audit retired
          { from: '/docs/audit/phase2-prompt-drift-audit', to: '/docs/architecture/overview' },
        ],
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Kickstart',
      logo: {
        alt: 'Kickstart Logo',
        src: 'img/favicon.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/azure-management-and-platforms/kickstart',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'What is Kickstart?',
              to: '/docs/intro',
            },
            {
              label: 'Getting Started',
              to: '/docs/getting-started/local-setup',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/azure-management-and-platforms/kickstart',
            },
            {
              label: 'Azure Kubernetes Service',
              href: 'https://learn.microsoft.com/azure/aks/',
            },
            {
              label: 'AKS Automatic',
              href: 'https://learn.microsoft.com/azure/aks/intro-aks-automatic',
            },
          ],
        },
      ],
      copyright: `Released under the MIT License. Copyright © ${new Date().getFullYear()} Microsoft Corporation. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
