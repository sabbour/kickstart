import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseFrontmatterFile } from './frontmatter.js';
import type { Pack } from '../types/pack.js';
import type { Skill } from '../types/skill.js';

const skillFrontmatterSchema = z.object({
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

function validateSkillName(name: string): string {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Skill name contains an invalid path-like segment: ${name}`);
  }
  return name;
}

export function loadSkillFile(pack: Pack, filePath: string): Skill {
  const baseDir = pack.skillsDir ? fileURLToPath(pack.skillsDir) : undefined;
  if (!baseDir) {
    throw new Error(`Pack ${pack.name} has no skillsDir configured.`);
  }

  const { attributes, body } = parseFrontmatterFile(baseDir, filePath);
  const parsed = skillFrontmatterSchema.parse(attributes);
  const validatedName = validateSkillName(parsed.name);

  return {
    id: `${pack.name}/${validatedName}`,
    name: validatedName,
    description: parsed.description,
    version: parsed.version,
    ...(parsed.author ? { author: parsed.author } : {}),
    ...(parsed.license ? { license: parsed.license } : {}),
    instructions: body,
    appliesTo: [...parsed['x-kickstart'].appliesTo],
    keywords: [...parsed['x-kickstart'].keywords],
    priority: parsed['x-kickstart'].priority,
    source: {
      kind: 'file',
      path: relative(resolve(baseDir), resolve(filePath)).replace(/\\/g, '/'),
    },
  };
}
