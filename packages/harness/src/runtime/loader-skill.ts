import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseFrontmatterFile } from './frontmatter.js';
import type { Pack } from '../types/pack.js';
import type { Skill } from '../types/skill.js';

const skillFrontmatterSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  author: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  'x-kickstart': z.object({
    appliesTo: z.array(z.string().min(1)).min(1),
    keywords: z.array(z.string().min(1)).min(1),
    priority: z.number().int(),
  }).strict(),
}).strict();

export const inlineSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  author: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  instructions: z.string().min(1),
  appliesTo: z.array(z.string().min(1)).min(1),
  keywords: z.array(z.string().min(1)).min(1),
  priority: z.number().int(),
  source: z.object({
    kind: z.enum(['inline', 'file']),
    path: z.string().optional(),
  }),
});

function validateSkillName(name: string): string {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Skill name contains an invalid path-like segment: ${name}`);
  }
  return name;
}

function normalizeSkillId(pack: Pack, rawId: string | undefined, fallbackName: string): string {
  if (!rawId) {
    return `${pack.name}/${validateSkillName(fallbackName)}`;
  }
  if (rawId.includes('..') || rawId.includes('\\')) {
    throw new Error(`Skill id contains an invalid path-like segment: ${rawId}`);
  }
  if (rawId.startsWith(`${pack.name}/`)) {
    return rawId;
  }
  if (rawId.startsWith(`${pack.name}.`)) {
    return `${pack.name}/${rawId.slice(pack.name.length + 1)}`;
  }
  throw new Error(`Skill id must be namespaced under ${pack.name}: ${rawId}`);
}

export function loadSkillFile(pack: Pack, filePath: string): Skill {
  const baseDir = pack.skillsDir ? fileURLToPath(pack.skillsDir) : undefined;
  if (!baseDir) {
    throw new Error(`Pack ${pack.name} has no skillsDir configured.`);
  }

  const { attributes, body } = parseFrontmatterFile(baseDir, filePath);
  const parsed = skillFrontmatterSchema.parse(attributes);
  const validatedName = validateSkillName(parsed.name);

  return Object.freeze({
    id: normalizeSkillId(pack, parsed.id, validatedName),
    name: validatedName,
    description: parsed.description,
    version: parsed.version,
    ...(parsed.author ? { author: parsed.author } : {}),
    ...(parsed.license ? { license: parsed.license } : {}),
    instructions: body,
    appliesTo: Object.freeze([...parsed['x-kickstart'].appliesTo]),
    keywords: Object.freeze([...parsed['x-kickstart'].keywords]),
    priority: parsed['x-kickstart'].priority,
    source: Object.freeze({
      kind: 'file' as const,
      path: relative(resolve(baseDir), resolve(filePath)).replace(/\\/g, '/'),
    }),
  }) as Skill;
}
