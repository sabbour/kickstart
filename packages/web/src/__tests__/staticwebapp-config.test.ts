import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface StaticWebAppRoute {
  route: string;
  allowedRoles?: string[];
}

interface StaticWebAppConfig {
  routes: StaticWebAppRoute[];
}

const config = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'packages/web/public/staticwebapp.config.json'),
    'utf8',
  ),
) as StaticWebAppConfig;

function allowedRolesFor(route: string): string[] | undefined {
  return config.routes.find((entry) => entry.route === route)?.allowedRoles;
}

describe('staticwebapp.config.json auth routes', () => {
  it('keeps inspiration endpoints anonymously accessible', () => {
    expect(allowedRolesFor('/api/inspirations')).toEqual(['anonymous']);
    expect(allowedRolesFor('/api/inspirations/*')).toEqual(['anonymous']);
  });

  it('keeps the API catch-all authenticated', () => {
    expect(allowedRolesFor('/api/*')).toEqual(['authenticated']);
  });
});
