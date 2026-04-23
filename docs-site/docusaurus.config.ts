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

  url: 'https://sabbour.github.io',
  baseUrl: '/kickstart/',

  organizationName: 'sabbour',
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
          editUrl: 'https://github.com/sabbour/kickstart/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
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
          href: 'https://github.com/sabbour/kickstart',
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
              href: 'https://github.com/sabbour/kickstart',
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
