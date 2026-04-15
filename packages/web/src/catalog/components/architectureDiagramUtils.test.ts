import { describe, expect, it, vi } from 'vitest';
import {
  expandIconPlaceholders,
  prepareArchitectureDiagramSource,
  renderArchitectureDiagramSvg,
} from './architectureDiagramUtils';

describe('architectureDiagramUtils', () => {
  it('expands allowlisted icon placeholders and drops unknown tokens', () => {
    const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
    const svg = '<svg><foreignObject><div>%%icon:azure/aks%%AKS%%icon:k8s/gateway%%Gateway%%icon:../../etc/passwd%%bad%%icon:k8s/ns%%namespace</div></foreignObject></svg>';

    const result = expandIconPlaceholders(svg, resolveIconUrl);

    expect(result).toContain('/icons/azure/aks.svg');
    expect(result).toContain('/icons/k8s/ns.svg');
    expect(result).not.toContain('%%icon');
    expect(result).not.toContain('k8s/gateway');
    expect(result).not.toContain('../../etc/passwd');
    expect(resolveIconUrl).toHaveBeenCalledTimes(2);
  });

  it('preserves line breaks while encoding unsafe html', () => {
    const prepared = prepareArchitectureDiagramSource(
      'graph TD\n  APP["API\\nsubtitle<br/><img src=x onerror=alert(1)>"]',
    );

    expect(prepared).toContain('API<br/>subtitle<br/>');
    expect(prepared).toContain('&lt;img src=x onerror=alert&#40;1&#41;>');
  });

  it('smoke-renders a grouped subgraph diagram through the ELK renderer helper', async () => {
    const renderSvg = vi.fn(async (_id: string, source: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>${source.includes('subgraph AKS') ? '%%icon:azure/aks%%AKS Automatic' : ''}</div></foreignObject></svg>`,
    }));

    const result = await renderArchitectureDiagramSvg(
      renderSvg,
      'arch-1',
      'graph TD\n  subgraph AKS["%%icon:azure/aks%%AKS Automatic"]\n    APP["Web API\\n(2-10 replicas)"]\n  end',
      (key) => (key === 'azure/aks' ? '/icons/aks.svg' : null),
    );

    expect(renderSvg).toHaveBeenCalledTimes(1);
    expect(renderSvg.mock.calls[0][1]).toContain('subgraph AKS["%%icon:azure/aks%%AKS Automatic"]');
    expect(renderSvg.mock.calls[0][1]).toContain('APP["Web API<br/>&#40;2-10 replicas&#41;"]');
    expect(result).toContain('<style>');
    expect(result).toContain('/icons/aks.svg');
  });
});
