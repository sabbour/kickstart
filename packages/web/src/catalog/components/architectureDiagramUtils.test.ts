import { describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_ICON_KEYS,
  expandIconPlaceholders,
  isAllowedIconKey,
  prepareArchitectureDiagramSource,
  renderArchitectureDiagramSvg,
} from './architectureDiagramUtils';

describe('architectureDiagramUtils', () => {
  // ---------------------------------------------------------------
  // isAllowedIconKey — direct allowlist + path-safety checks
  // ---------------------------------------------------------------

  describe('isAllowedIconKey', () => {
    it('accepts every pre-existing k8s icon key', () => {
      const existingK8s = [
        'k8s/deploy',
        'k8s/svc',
        'k8s/sa',
        'k8s/ns',
        'k8s/hpa',
        'k8s/pod',
        'k8s/ing',
        'k8s/secret',
        'k8s/pvc',
        'k8s/cm',
        'k8s/crd',
        'k8s/job',
        'k8s/sts',
        'k8s/ds',
        'k8s/netpol',
      ];
      for (const key of existingK8s) {
        expect(isAllowedIconKey(key), `expected ${key} to be allowed`).toBe(true);
      }
    });

    it('accepts newly added k8s icons: gateway, httproute, pdb, vpa, cronjob, role, rb', () => {
      const newK8s = [
        'k8s/gateway',
        'k8s/httproute',
        'k8s/pdb',
        'k8s/vpa',
        'k8s/cronjob',
        'k8s/role',
        'k8s/rb',
      ];
      for (const key of newK8s) {
        expect(isAllowedIconKey(key), `expected ${key} to be allowed`).toBe(true);
      }
    });

    it('accepts DRA resource keys: deviceclass, resourceclaim, resourceclaimtemplate, resourceslice', () => {
      const draKeys = [
        'k8s/deviceclass',
        'k8s/resourceclaim',
        'k8s/resourceclaimtemplate',
        'k8s/resourceslice',
      ];
      for (const key of draKeys) {
        expect(isAllowedIconKey(key), `expected ${key} to be allowed`).toBe(true);
      }
    });

    it('accepts inference + picker keys: inferencepool, inferenceobjective, endpointpicker', () => {
      const inferenceKeys = [
        'k8s/inferencepool',
        'k8s/inferenceobjective',
        'k8s/endpointpicker',
      ];
      for (const key of inferenceKeys) {
        expect(isAllowedIconKey(key), `expected ${key} to be allowed`).toBe(true);
      }
    });

    it('rejects path-traversal sequences disguised as icon keys', () => {
      expect(isAllowedIconKey('../../etc/passwd')).toBe(false);
      expect(isAllowedIconKey('k8s/../../../etc/passwd')).toBe(false);
      expect(isAllowedIconKey('../k8s/deploy')).toBe(false);
      expect(isAllowedIconKey('k8s/./deploy')).toBe(false);
    });

    it('rejects uppercase variants (pattern is lowercase only)', () => {
      expect(isAllowedIconKey('k8s/Deploy')).toBe(false);
      expect(isAllowedIconKey('K8S/deploy')).toBe(false);
      expect(isAllowedIconKey('Azure/aks')).toBe(false);
    });

    it('rejects empty, partial, or structurally invalid keys', () => {
      expect(isAllowedIconKey('')).toBe(false);
      expect(isAllowedIconKey('k8s/')).toBe(false);
      expect(isAllowedIconKey('/deploy')).toBe(false);
      expect(isAllowedIconKey('deploy')).toBe(false);
      expect(isAllowedIconKey('k8s')).toBe(false);
      expect(isAllowedIconKey('k8s/deploy/extra')).toBe(false);
    });

    it('rejects pattern-valid keys that are not in the allowlist', () => {
      expect(isAllowedIconKey('k8s/foobar')).toBe(false);
      expect(isAllowedIconKey('azure/nonexistent')).toBe(false);
      expect(isAllowedIconKey('gcp/compute')).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // ALLOWED_ICON_KEYS — membership assertions
  // ---------------------------------------------------------------

  describe('ALLOWED_ICON_KEYS', () => {
    it('includes all expected k8s resource types', () => {
      const expectedK8s = [
        'k8s/deploy',
        'k8s/svc',
        'k8s/sa',
        'k8s/ns',
        'k8s/hpa',
        'k8s/pod',
        'k8s/ing',
        'k8s/secret',
        'k8s/pvc',
        'k8s/cm',
        'k8s/crd',
        'k8s/job',
        'k8s/sts',
        'k8s/ds',
        'k8s/netpol',
        'k8s/gateway',
        'k8s/httproute',
        'k8s/pdb',
        'k8s/vpa',
        'k8s/cronjob',
        'k8s/role',
        'k8s/rb',
      ];
      for (const key of expectedK8s) {
        expect(ALLOWED_ICON_KEYS).toContain(key);
      }
    });

    it('includes DRA resource keys in the allowlist', () => {
      const draKeys = [
        'k8s/deviceclass',
        'k8s/resourceclaim',
        'k8s/resourceclaimtemplate',
        'k8s/resourceslice',
      ];
      for (const key of draKeys) {
        expect(ALLOWED_ICON_KEYS).toContain(key);
      }
    });

    it('includes inference + picker keys in the allowlist', () => {
      const inferenceKeys = [
        'k8s/inferencepool',
        'k8s/inferenceobjective',
        'k8s/endpointpicker',
      ];
      for (const key of inferenceKeys) {
        expect(ALLOWED_ICON_KEYS).toContain(key);
      }
    });

    it('does not contain duplicate entries', () => {
      const unique = new Set(ALLOWED_ICON_KEYS);
      expect(unique.size).toBe(ALLOWED_ICON_KEYS.length);
    });

    it('every entry matches the lowercase namespace/name pattern', () => {
      const pattern = /^[a-z0-9]+\/[a-z0-9-]+$/;
      for (const key of ALLOWED_ICON_KEYS) {
        expect(key).toMatch(pattern);
      }
    });
  });

  // ---------------------------------------------------------------
  // expandIconPlaceholders — rendering + security
  // ---------------------------------------------------------------

  describe('expandIconPlaceholders', () => {
    it('expands allowlisted icons and strips path-traversal / unknown tokens', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg =
        '<svg><foreignObject><div>' +
        '%%icon:azure/aks%%AKS' +
        '%%icon:k8s/gateway%%Gateway' +
        '%%icon:../../etc/passwd%%bad' +
        '%%icon:k8s/ns%%namespace' +
        '</div></foreignObject></svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/azure/aks.svg');
      expect(result).toContain('/icons/k8s/gateway.svg');
      expect(result).toContain('/icons/k8s/ns.svg');
      expect(result).not.toContain('%%icon');
      expect(result).not.toContain('../../etc/passwd');
      expect(resolveIconUrl).toHaveBeenCalledTimes(3);
    });

    it('renders new k8s icons: httproute, pdb, vpa in placeholders', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg =
        '<svg>' +
        '%%icon:k8s/httproute%%HTTPRoute' +
        '%%icon:k8s/pdb%%PDB' +
        '%%icon:k8s/vpa%%VPA' +
        '</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/k8s/httproute.svg');
      expect(result).toContain('/icons/k8s/pdb.svg');
      expect(result).toContain('/icons/k8s/vpa.svg');
      expect(resolveIconUrl).toHaveBeenCalledTimes(3);
    });

    it('handles whitespace around icon keys via case-insensitive trim', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg = '<svg>%%icon: k8s/ns %%ns</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/k8s/ns.svg');
    });

    it('produces img tags with empty alt for decorative icons (a11y)', () => {
      const resolveIconUrl = vi.fn(() => '/icons/k8s/pod.svg');
      const svg = '<svg>%%icon:k8s/pod%%Pod</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('alt=""');
      expect(result).toContain('width="20"');
      expect(result).toContain('height="20"');
    });

    it('silently drops icons when resolver returns null', () => {
      const resolveIconUrl = vi.fn(() => null);
      const svg = '<svg>%%icon:k8s/deploy%%Deploy</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).not.toContain('<img');
      expect(result).not.toContain('%%icon');
    });

    it('handles consecutive placeholders without separating text', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg = '<svg>%%icon:k8s/svc%%%%icon:k8s/pod%%</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/k8s/svc.svg');
      expect(result).toContain('/icons/k8s/pod.svg');
      expect(resolveIconUrl).toHaveBeenCalledTimes(2);
    });

    it('is case-insensitive for the placeholder marker itself', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg = '<svg>%%ICON:k8s/pod%%Pod%%Icon:k8s/svc%%Svc</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/k8s/pod.svg');
      expect(result).toContain('/icons/k8s/svc.svg');
    });

    it('expands DRA placeholders: deviceclass, resourceclaim, resourceclaimtemplate, resourceslice', () => {
      const resolveIconUrl = vi.fn((key: string) => `/assets/icons/${key}.svg`);
      const svg =
        '<svg>' +
        '%%icon:k8s/deviceclass%%DeviceClass' +
        '%%icon:k8s/resourceclaim%%ResourceClaim' +
        '%%icon:k8s/resourceclaimtemplate%%ResourceClaimTemplate' +
        '%%icon:k8s/resourceslice%%ResourceSlice' +
        '</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/assets/icons/k8s/deviceclass.svg');
      expect(result).toContain('/assets/icons/k8s/resourceclaim.svg');
      expect(result).toContain('/assets/icons/k8s/resourceclaimtemplate.svg');
      expect(result).toContain('/assets/icons/k8s/resourceslice.svg');
      expect(result).not.toContain('%%icon');
      expect(resolveIconUrl).toHaveBeenCalledTimes(4);
    });

    it('expands inference + picker placeholders: inferencepool, inferenceobjective, endpointpicker', () => {
      const resolveIconUrl = vi.fn((key: string) => `/assets/icons/${key}.svg`);
      const svg =
        '<svg>' +
        '%%icon:k8s/inferencepool%%InferencePool' +
        '%%icon:k8s/inferenceobjective%%InferenceObjective' +
        '%%icon:k8s/endpointpicker%%EndPointPicker' +
        '</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/assets/icons/k8s/inferencepool.svg');
      expect(result).toContain('/assets/icons/k8s/inferenceobjective.svg');
      expect(result).toContain('/assets/icons/k8s/endpointpicker.svg');
      expect(result).not.toContain('%%icon');
      expect(resolveIconUrl).toHaveBeenCalledTimes(3);
    });

    it('renders cronjob, role, rb icon placeholders correctly', () => {
      const resolveIconUrl = vi.fn((key: string) => `/icons/${key}.svg`);
      const svg =
        '<svg>' +
        '%%icon:k8s/cronjob%%CronJob' +
        '%%icon:k8s/role%%Role' +
        '%%icon:k8s/rb%%RoleBinding' +
        '</svg>';

      const result = expandIconPlaceholders(svg, resolveIconUrl);

      expect(result).toContain('/icons/k8s/cronjob.svg');
      expect(result).toContain('/icons/k8s/role.svg');
      expect(result).toContain('/icons/k8s/rb.svg');
      expect(resolveIconUrl).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------
  // prepareArchitectureDiagramSource — HTML sanitisation
  // ---------------------------------------------------------------

  it('preserves line breaks while encoding unsafe html', () => {
    const prepared = prepareArchitectureDiagramSource(
      'graph TD\n  APP["API\\nsubtitle<br/><img src=x onerror=alert(1)>"]',
    );

    expect(prepared).toContain('API<br/>subtitle<br/>');
    expect(prepared).toContain('&lt;img src=x onerror=alert&#40;1&#41;>');
  });

  // ---------------------------------------------------------------
  // renderArchitectureDiagramSvg — full pipeline smoke test
  // ---------------------------------------------------------------

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

  it('renders DRA icons through the full pipeline', async () => {
    const iconMap: Record<string, string> = {
      'k8s/deviceclass': '/assets/icons/k8s/deviceclass.svg',
      'k8s/resourceclaim': '/assets/icons/k8s/resourceclaim.svg',
    };
    const renderSvg = vi.fn(async (_id: string, _source: string) => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>%%icon:k8s/deviceclass%%GPU%%icon:k8s/resourceclaim%%Claim</div></foreignObject></svg>',
    }));

    const result = await renderArchitectureDiagramSvg(
      renderSvg,
      'arch-dra',
      'graph TD\n  DC["%%icon:k8s/deviceclass%%GPU"]\n  RC["%%icon:k8s/resourceclaim%%Claim"]',
      (key) => iconMap[key] ?? null,
    );

    expect(result).toContain('/assets/icons/k8s/deviceclass.svg');
    expect(result).toContain('/assets/icons/k8s/resourceclaim.svg');
    expect(result).toContain('<style>');
    expect(result).not.toContain('%%icon');
  });

  it('renders inference + picker icons through the full pipeline', async () => {
    const iconMap: Record<string, string> = {
      'k8s/inferencepool': '/assets/icons/k8s/inferencepool.svg',
      'k8s/endpointpicker': '/assets/icons/k8s/endpointpicker.svg',
    };
    const renderSvg = vi.fn(async (_id: string, _source: string) => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>%%icon:k8s/inferencepool%%Pool%%icon:k8s/endpointpicker%%Picker</div></foreignObject></svg>',
    }));

    const result = await renderArchitectureDiagramSvg(
      renderSvg,
      'arch-inference',
      'graph TD\n  IP["%%icon:k8s/inferencepool%%Pool"]\n  EP["%%icon:k8s/endpointpicker%%Picker"]',
      (key) => iconMap[key] ?? null,
    );

    expect(result).toContain('/assets/icons/k8s/inferencepool.svg');
    expect(result).toContain('/assets/icons/k8s/endpointpicker.svg');
    expect(result).toContain('<style>');
    expect(result).not.toContain('%%icon');
  });

  // ---------------------------------------------------------------
  // Fluent 2 injected diagram CSS — structural contract (#347)
  // These tests lock the Fluent 2 restyle expectations.
  // TDD-red: skip until #347 implementation lands.
  // ---------------------------------------------------------------

  describe.skip('Fluent 2 diagram CSS contract', () => {
    async function getInjectedStyle(): Promise<string> {
      const renderSvg = vi.fn(async () => ({
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>',
      }));
      const result = await renderArchitectureDiagramSvg(
        renderSvg,
        'style-test',
        'graph TD\n  A["Node"]',
        () => null,
      );
      const match = result.match(/<style>([\s\S]*?)<\/style>/);
      return match?.[1] ?? '';
    }

    it('injects a non-empty <style> block into the rendered SVG', async () => {
      const css = await getInjectedStyle();
      expect(css.length).toBeGreaterThan(0);
    });

    it('targets cluster, edge, and node selectors in injected CSS', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.cluster\s/);
      expect(css).toMatch(/\.edgePath/);
      expect(css).toMatch(/\.edgeLabel/);
      expect(css).toMatch(/\.nodeLabel|\.node\s+\.label/);
    });

    it('uses Fluent 2 medium corner radius (4px) on cluster rects', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.cluster rect[\s\S]*?rx:\s*4/);
    });

    it('uses Fluent 2 medium corner radius (4px) on edge labels', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.edgeLabel[\s\S]*?border-radius:\s*4px/);
    });

    it('uses Fluent 2 thin stroke-width (1) on edges', async () => {
      const css = await getInjectedStyle();
      const edgeBlock = css.match(/\.edgePath .path[\s\S]*?(?=\.\w|\}$)/)?.[0] ?? '';
      expect(edgeBlock).toMatch(/stroke-width:\s*1[^.]|stroke-width:\s*1;/);
    });

    it('uses Fluent 2 neutralStroke1 (#d1d1d1) on edge paths', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.edgePath .path[\s\S]*?stroke:\s*#d1d1d1/);
    });

    it('uses Fluent 2 semibold (600) font-weight on node labels', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/(\.nodeLabel|\.node\s+\.label)[\s\S]*?font-weight:\s*600/);
    });

    it('uses Fluent 2 neutralBackground3 (#f5f5f5) for cluster fill', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.cluster rect[\s\S]*?fill:\s*#f5f5f5/);
    });

    it('uses Fluent 2 neutralStroke2 (#e0e0e0) for cluster stroke', async () => {
      const css = await getInjectedStyle();
      expect(css).toMatch(/\.cluster rect[\s\S]*?stroke:\s*#e0e0e0/);
    });
  });
});
