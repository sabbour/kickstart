/**
 * @module @kickstart/core/skills
 *
 * Public Copilot skill system — build-time bundling of external skills
 * from configured GitHub repositories.
 *
 * ## Architecture
 *
 * - **Sync pipeline** (`sync-public-skills.ts`): Build-time CLI that fetches,
 *   validates, and bundles skills into `public-skills.lock.json`
 * - **Loader** (`public-skill-loader.ts`): Runtime loader that reads from the
 *   committed lockfile (zero network calls)
 * - **Policy scanner** (`skill-policy.ts`): Security policy enforcement
 * - **Phase mapper** (`phase-mapper.ts`): Keyword → Phase classification
 *
 * ## Security
 *
 * - SHA-only immutable pinning (no branches/tags)
 * - Commit signature verification + trusted org allowlist
 * - Executable code patterns → reject
 * - Structured JSON representation (no raw markdown in prompts)
 * - Fail-closed sync pipeline
 * - Zero-network runtime loader
 */

// Types
export type {
  PublicSkillSource,
  PublicSkillsConfig,
  SkillProvenance,
  SkillKnowledgeBlock,
  SkillFrontmatter,
  ParsedSkillMd,
  PolicyViolation,
  PolicySeverity,
  LockfileSkillEntry,
  LockfileSourceEntry,
  PublicSkillsLockfile,
} from './types.js';

export {
  PUBLIC_SKILL_PRIORITY,
  MAX_SKILL_FILE_SIZE,
  MAX_SKILL_TOKENS,
  MAX_SKILLS_PER_REPO,
  SHA_PATTERN,
  POLICY_VERSION,
} from './types.js';

// Runtime loader (zero network)
export {
  loadPublicSkills,
  createPublicSkillKit,
  loadPublicSkillKit,
  formatPublicSkillContent,
} from './public-skill-loader.js';

// Build-time sync pipeline
export {
  syncPublicSkills,
  validateConfig,
} from './sync-public-skills.js';
export type { SyncResult } from './sync-public-skills.js';

// Policy scanner
export {
  scanSkillPolicy,
  stripHtmlInjection,
  hasErrors,
} from './skill-policy.js';

// Phase mapper
export {
  classifyToPhases,
  extractKeywords,
} from './phase-mapper.js';

// Frontmatter parser
export { parseSkillMd } from './frontmatter-parser.js';

// Knowledge extractor
export {
  extractKnowledgeFacts,
  extractQuestionPatterns,
} from './knowledge-extractor.js';
