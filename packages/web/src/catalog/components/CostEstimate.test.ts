import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentContext } from '../../vendor/a2ui/web_core/index';
import { ConversationSessionProvider } from '../../contexts/ConversationSessionContext';
import type { CostEstimateInput } from '../../utils/cost-estimate';

// Fluent v9 components pull in a chain of internal context hooks
// (useTextDirection, useFluent, useCardBase_unstable, etc.) that resolve
// `react` via commonjs and trip the "Cannot read properties of null"
// dispatcher error when rendered from node with renderToStaticMarkup.
// For this markup-only contract test we stub out just the surface used by
// CostEstimate with pass-through <div>s and a no-op makeStyles.
vi.mock('@fluentui/react-components', async () => {
  const actual = await vi.importActual<typeof import('@fluentui/react-components')>(
    '@fluentui/react-components',
  );
  const passthrough = (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement(tag, rest as Record<string, unknown>, children);
  return {
    ...actual,
    makeStyles: (styles: Record<string, unknown>) => () =>
      Object.fromEntries(Object.keys(styles).map((k) => [k, k])) as Record<string, string>,
    tokens: new Proxy({}, { get: () => '' }) as unknown as typeof actual.tokens,
    Badge: passthrough('span'),
    Body2: passthrough('p'),
    Button: passthrough('button'),
    Caption1: passthrough('span'),
    Card: passthrough('section'),
    Label: passthrough('label'),
    MessageBar: passthrough('div'),
    MessageBarBody: passthrough('div'),
    Select: passthrough('select'),
    Slider: passthrough('input'),
    Spinner: passthrough('span'),
    Subtitle1: passthrough('h3'),
  };
});

vi.mock('@fluentui/react-icons', () => ({
  MoneyRegular: () => React.createElement('span', { 'data-icon': 'money' }),
}));

// Import after mocks so CostEstimate.tsx binds to the stubs.
const { CostEstimateView } = await import('./CostEstimate');

const componentContext = {
  dispatchAction: vi.fn(),
} as unknown as ComponentContext;

function renderCostEstimate(
  props: CostEstimateInput,
  sessionOverrides: Partial<React.ComponentProps<typeof ConversationSessionProvider>['value']> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(
      ConversationSessionProvider,
      {
        value: {
          localSessionId: 'local-session',
          backendSessionId: null,
          currentPhase: 'review',
          getDeploymentFiles: async () => [],
          ...sessionOverrides,
        },
        children: React.createElement(CostEstimateView, {
          props: props as React.ComponentProps<typeof CostEstimateView>['props'],
          context: componentContext,
          buildChild: () => null,
        }),
      },
    ),
  );
}

describe('CostEstimate', () => {
  it('shows a loading state while live pricing is being fetched', () => {
    const markup = renderCostEstimate({
      resources: [{ name: 'AKS Automatic control plane', monthlyEstimate: 116.8 }],
      monthlyEstimate: 116.8,
      currency: 'USD',
      pricingRequest: {
        region: 'eastus',
        lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
      },
    }, {
      backendSessionId: 'session-123',
    });

    expect(markup).toContain('Loading live pricing…');
    expect(markup).toContain('Fetching live prices from Azure Retail Prices API…');
    expect(markup).not.toContain('Estimated fallback');
  });

  it('renders explicit live pricing citation when live data is available', () => {
    const markup = renderCostEstimate({
      resources: [{ name: 'AKS Automatic control plane', monthlyEstimate: 116.8 }],
      monthlyEstimate: 116.8,
      currency: 'USD',
      source: 'live',
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
    });

    expect(markup).toContain('Live Azure pricing');
    expect(markup).toContain('Prices from Azure Retail Prices API (East US, consumption).');
  });

  it('renders cached live pricing distinctly from estimated fallback', () => {
    const liveMarkup = renderCostEstimate({
      resources: [{ name: 'Container Registry', sku: 'Basic', monthlyEstimate: 5.07 }],
      monthlyEstimate: 5.07,
      currency: 'USD',
      source: 'live',
      cache: { status: 'hit' },
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
    });

    const fallbackMarkup = renderCostEstimate({
      resources: [{ name: 'Storage Account', sku: 'E30 LRS', monthlyEstimate: 6.57 }],
      monthlyEstimate: 6.57,
      currency: 'USD',
      source: 'estimated',
      fallback: { used: true, reason: 'live_pricing_unavailable' },
      citation: 'Live Azure pricing is unavailable right now, so these are estimated monthly prices for East US.',
    });

    expect(liveMarkup).toContain('Cached live pricing');
    expect(liveMarkup).not.toContain('Estimated fallback');
    expect(fallbackMarkup).toContain('Estimated fallback');
    expect(fallbackMarkup).toContain('Live Azure pricing is unavailable right now');
  });

  it('renders usage-based rows honestly without adding them into the monthly total', () => {
    const markup = renderCostEstimate({
      resources: [
        {
          name: 'Azure OpenAI',
          sku: 'GPT-4.1 Mini input',
          monthlyEstimate: 0,
          pricingModel: 'usage',
          unitPrice: 0.00044,
          unitOfMeasure: '1K tokens',
        },
      ],
      monthlyEstimate: 0,
      currency: 'USD',
      source: 'live',
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
    });

    expect(markup).toContain('$0.00044 / 1K tokens');
    expect(markup).toContain('Excluded from monthly total until usage is known');
  });

  it('keeps rendering legacy items + total payloads during the contract migration', () => {
    const markup = renderCostEstimate({
      items: [{ name: 'App Platform', sku: 'Standard', monthlyCost: 116.8 }],
      total: 116.8,
      currency: 'USD',
      source: 'stub',
      fallback: true,
    });

    expect(markup).toContain('App Platform');
    expect(markup).toContain('$116.80');
    expect(markup).toContain('Estimated fallback');
  });
});
