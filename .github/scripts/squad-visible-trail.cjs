const ISSUE_TRAIL_MARKER = '<!-- squad-visible-trail:issue -->';
const PR_TRAIL_MARKER = '<!-- squad-visible-trail:pr -->';
const REVIEW_MARKER_PREFIX = '<!-- squad-visible-trail:review:';
const LOW_RISK_LABEL = 'squad:chore-auto';
const ISSUE_LABEL_PREFIXES = ['squad:', 'go:', 'release:', 'type:', 'priority:'];
const SENSITIVE_PATH_PATTERNS = [
  /^\.github\/workflows\//i,
  /(^|[\/._-])(auth|guardrail|guardrails|security)([\/._-]|$)/i,
];
const REVIEW_LABELS = {
  'leela:approved': {
    reviewer: 'Leela',
    domain: 'architecture',
    outcome: 'approved',
    emoji: '✅',
    reviewEvent: 'APPROVE',
    reviewState: 'APPROVED',
  },
  'leela:rejected': {
    reviewer: 'Leela',
    domain: 'architecture',
    outcome: 'rejected',
    emoji: '🛑',
    reviewEvent: 'REQUEST_CHANGES',
    reviewState: 'CHANGES_REQUESTED',
  },
  'zapp:approved': {
    reviewer: 'Zapp',
    domain: 'security',
    outcome: 'approved',
    emoji: '✅',
    reviewEvent: 'APPROVE',
    reviewState: 'APPROVED',
  },
  'zapp:rejected': {
    reviewer: 'Zapp',
    domain: 'security',
    outcome: 'rejected',
    emoji: '🛑',
    reviewEvent: 'REQUEST_CHANGES',
    reviewState: 'CHANGES_REQUESTED',
  },
};

function getLabelName(label) {
  if (typeof label === 'string') {
    return label;
  }
  return label?.name ?? null;
}

function includesMarker(body, marker) {
  return typeof body === 'string' && body.includes(marker);
}

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : 'unknown';
}

function isManagedIssueLabel(name) {
  return name === 'squad' || ISSUE_LABEL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isManagedPrLabel(name) {
  return name === LOW_RISK_LABEL || Object.prototype.hasOwnProperty.call(REVIEW_LABELS, name);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatLabelLine(labelName, descriptions) {
  const description = descriptions[labelName];
  return description ? `- \`${labelName}\` — ${description}` : `- \`${labelName}\``;
}

function buildSection(title, labelNames, descriptions, emptyState) {
  return [
    `**${title}**`,
    labelNames.length > 0
      ? labelNames.map((labelName) => formatLabelLine(labelName, descriptions)).join('\n')
      : `- ${emptyState}`,
  ].join('\n');
}

async function listIssueComments({ github, context, issueNumber }) {
  return github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    per_page: 100,
  });
}

async function upsertIssueComment({ github, context, issueNumber, marker, body, comments }) {
  const issueComments = comments ?? await listIssueComments({ github, context, issueNumber });
  const existing = issueComments.find((comment) => includesMarker(comment.body, marker));

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
    return 'updated';
  }

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
  return 'created';
}

async function getLabelDescriptions({ github, context, labelNames }) {
  const descriptions = {};

  for (const labelName of uniq(labelNames)) {
    try {
      const { data } = await github.rest.issues.getLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: labelName,
      });
      descriptions[labelName] = data.description ?? '';
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      descriptions[labelName] = '';
    }
  }

  return descriptions;
}

function describeIssueChange(action, labelName, descriptions) {
  if (!labelName || !isManagedIssueLabel(labelName)) {
    return 'Squad automation labels changed.';
  }

  const description = descriptions[labelName];
  const suffix = description ? ` — ${description}` : '';
  return action === 'unlabeled'
    ? `Label removed: \`${labelName}\`${suffix}`
    : `Label applied: \`${labelName}\`${suffix}`;
}

function isSecurityPatch(pr, labels) {
  const securitySignals = [
    pr.title,
    pr.body,
    pr.head?.ref,
    ...labels,
  ].filter(Boolean).join(' ');
  return /security|cve-\d{4}-\d+|ghsa-|vuln|vulnerability/i.test(securitySignals);
}

function isSensitivePath(filename) {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(filename));
}

async function listChangedFiles({ github, context, prNumber }) {
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return files.map((file) => file.filename);
}

function getZappRequirementReason(pr, labels, changedFiles) {
  if (!labels.has(LOW_RISK_LABEL)) {
    return 'standard review path';
  }

  if (isSecurityPatch(pr, labels)) {
    return 'security-sensitive title/body/branch/label signal';
  }

  const sensitiveFiles = changedFiles.filter(isSensitivePath);
  if (sensitiveFiles.length > 0) {
    const preview = sensitiveFiles.slice(0, 3).map((file) => `\`${file}\``).join(', ');
    return `sensitive paths touched (${preview}${sensitiveFiles.length > 3 ? ', …' : ''})`;
  }

  return null;
}

function getRequiredApprovals(pr, labels, changedFiles) {
  const required = ['leela:approved'];
  const zappRequirementReason = getZappRequirementReason(pr, labels, changedFiles);

  if (!labels.has(LOW_RISK_LABEL) || zappRequirementReason) {
    required.push('zapp:approved');
  }

  return { required, zappRequirementReason };
}

function getReviewerStatus(labels, reviewer, isOptional = false) {
  const approvedLabel = `${reviewer}:approved`;
  const rejectedLabel = `${reviewer}:rejected`;
  const hasApproved = labels.has(approvedLabel);
  const hasRejected = labels.has(rejectedLabel);

  if (hasApproved && hasRejected) {
    return `⚠️ conflicting labels on the current head (\`${approvedLabel}\` + \`${rejectedLabel}\`)`;
  }

  if (hasRejected) {
    return `🛑 changes requested via \`${rejectedLabel}\``;
  }

  if (hasApproved) {
    return `✅ approved via \`${approvedLabel}\``;
  }

  if (isOptional) {
    return '➖ not required on the current low-risk path';
  }

  return `⏳ awaiting \`${approvedLabel}\``;
}

function describePrChange(action, labelName) {
  if (action === 'labeled' && labelName) {
    return `Label applied: \`${labelName}\`.`;
  }

  if (action === 'unlabeled' && labelName) {
    return `Label removed: \`${labelName}\`.`;
  }

  if (action === 'synchronize') {
    return 'New commits landed; the visible trail now points at the current head.';
  }

  if (action === 'ready_for_review') {
    return 'PR marked ready for review.';
  }

  if (action === 'reopened') {
    return 'PR reopened.';
  }

  return 'Squad review state refreshed.';
}

function buildNativeReviewBody(labelName, pr) {
  const review = REVIEW_LABELS[labelName];
  return [
    `${REVIEW_MARKER_PREFIX}${labelName} -->`,
    `${review.emoji} ${review.reviewer} recorded a ${review.domain} ${review.outcome} via \`${labelName}\` on head \`${shortSha(pr.head.sha)}\`.`,
    '',
    'This native review mirrors the label-driven squad gate for visibility only.',
    'Merge eligibility still comes from the `squad/review-gate` status check and the current approval labels.',
  ].join('\n');
}

async function ensureNativeReview({ github, context, core, pr, labelName }) {
  const review = REVIEW_LABELS[labelName];
  if (!review) {
    return 'skipped';
  }

  const marker = `${REVIEW_MARKER_PREFIX}${labelName}`;
  const reviews = await github.paginate(github.rest.pulls.listReviews, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const existing = reviews.find((entry) =>
    entry.commit_id === pr.head.sha
    && entry.state === review.reviewState
    && includesMarker(entry.body, marker),
  );

  if (existing) {
    return 'existing';
  }

  try {
    await github.rest.pulls.createReview({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      commit_id: pr.head.sha,
      event: review.reviewEvent,
      body: buildNativeReviewBody(labelName, pr),
    });
    return 'created';
  } catch (error) {
    core.warning(`Could not create native PR review for ${labelName} on #${pr.number}: ${error.message}`);
    return 'fallback';
  }
}

async function handleIssueEvent({ github, context, core }) {
  const issue = context.payload.issue;
  if (!issue || issue.pull_request) {
    return;
  }

  const changedLabel = context.payload.label?.name ?? null;
  const managedLabels = issue.labels.map(getLabelName).filter(isManagedIssueLabel);
  const needsTrail = Boolean(changedLabel && isManagedIssueLabel(changedLabel)) || managedLabels.length > 0;

  const comments = await listIssueComments({ github, context, issueNumber: issue.number });
  const hasExistingTrail = comments.some((comment) => includesMarker(comment.body, ISSUE_TRAIL_MARKER));
  if (!needsTrail && !hasExistingTrail) {
    return;
  }

  const descriptions = await getLabelDescriptions({
    github,
    context,
    labelNames: [...managedLabels, changedLabel],
  });

  const routingLabels = managedLabels.filter((label) => label === 'squad' || label.startsWith('squad:'));
  const goLabels = managedLabels.filter((label) => label.startsWith('go:'));
  const typeLabels = managedLabels.filter((label) => label.startsWith('type:'));
  const priorityLabels = managedLabels.filter((label) => label.startsWith('priority:'));
  const releaseLabels = managedLabels.filter((label) => label.startsWith('release:'));

  const body = [
    ISSUE_TRAIL_MARKER,
    '### 👀 Squad automation trail',
    '',
    `**Last update:** ${describeIssueChange(context.payload.action, changedLabel, descriptions)}`,
    '',
    buildSection('Routing', routingLabels, descriptions, 'No active squad routing labels.'),
    '',
    buildSection('Triage verdict', goLabels, descriptions, 'No current `go:` verdict.'),
    '',
    buildSection('Type', typeLabels, descriptions, 'No current `type:` label.'),
    '',
    buildSection('Priority', priorityLabels, descriptions, 'No current `priority:` label.'),
    '',
    buildSection('Release target', releaseLabels, descriptions, 'No current `release:` label.'),
    '',
    '> This sticky comment is maintained automatically so label-driven squad routing always leaves a visible rationale on the issue.',
  ].join('\n');

  await upsertIssueComment({
    github,
    context,
    issueNumber: issue.number,
    marker: ISSUE_TRAIL_MARKER,
    body,
    comments,
  });
}

async function handlePullRequestEvent({ github, context, core }) {
  const pr = context.payload.pull_request;
  if (!pr) {
    return;
  }

  const labels = new Set(pr.labels.map(getLabelName).filter(Boolean));
  const changedLabel = context.payload.label?.name ?? null;
  const comments = await listIssueComments({ github, context, issueNumber: pr.number });
  const hasExistingTrail = comments.some((comment) => includesMarker(comment.body, PR_TRAIL_MARKER));
  const looksLikeSquadPr = pr.head?.ref?.startsWith('squad/');
  const hasManagedLabels = [...labels].some((label) => isManagedPrLabel(label));
  if (!looksLikeSquadPr && !hasManagedLabels && !hasExistingTrail) {
    return;
  }

  let reviewMirror = 'skipped';
  if (context.payload.action === 'labeled' && changedLabel && Object.prototype.hasOwnProperty.call(REVIEW_LABELS, changedLabel)) {
    reviewMirror = await ensureNativeReview({ github, context, core, pr, labelName: changedLabel });
  }

  const changedFiles = await listChangedFiles({ github, context, prNumber: pr.number });
  const { required, zappRequirementReason } = getRequiredApprovals(pr, labels, changedFiles);
  const missingApprovals = required.filter((label) => !labels.has(label));
  const descriptions = await getLabelDescriptions({
    github,
    context,
    labelNames: [...labels].filter(isManagedPrLabel).concat(changedLabel),
  });
  const activeManagedLabels = [...labels].filter(isManagedPrLabel).sort();
  const hasRejection = labels.has('leela:rejected') || labels.has('zapp:rejected');
  const zappOptional = labels.has(LOW_RISK_LABEL) && !zappRequirementReason;

  const gatePath = !labels.has(LOW_RISK_LABEL)
    ? 'Standard path — both `leela:approved` and `zapp:approved` are required on the current head.'
    : zappRequirementReason
      ? `Low-risk label present, but ` + `\`zapp:approved\`` + ` is still required because ${zappRequirementReason}.`
      : 'Low-risk path — `squad:chore-auto` + `leela:approved` are enough on the current head.';

  const gateSnapshot = missingApprovals.length === 0
    ? '✅ `squad/review-gate` should be green on the current head.'
    : `⏳ Missing ${missingApprovals.map((label) => `\`${label}\``).join(' + ')} on the current head.`;

  const mirrorNote = reviewMirror === 'created'
    ? '- Native PR review mirror created for this label event.'
    : reviewMirror === 'existing'
      ? '- Native PR review mirror already existed for this head; skipped duplicate review.'
      : reviewMirror === 'fallback'
        ? '- Native PR review mirror was unavailable on this run, so the sticky comment is the visible trail.'
        : null;

  const body = [
    PR_TRAIL_MARKER,
    '### 👀 Squad review trail',
    '',
    `**Current head:** \`${shortSha(pr.head.sha)}\``,
    `**Last update:** ${describePrChange(context.payload.action, changedLabel)}`,
    mirrorNote,
    '',
    `**Gate path:** ${gatePath}`,
    `**Gate snapshot:** ${gateSnapshot}`,
    '',
    '**Reviewer labels**',
    `- Leela: ${getReviewerStatus(labels, 'leela')}`,
    `- Zapp: ${getReviewerStatus(labels, 'zapp', zappOptional)}`,
    '',
    buildSection('Active labels', activeManagedLabels, descriptions, 'No active squad review labels.'),
    hasRejection
      ? '\n⚠️ A rejection label is present. Keep the approval labels and rejection labels in sync so the visible trail matches reviewer intent.'
      : '',
    '',
    '> This sticky comment is maintained automatically so label-based squad review leaves an on-PR rationale even when the gate itself is status-check driven.',
  ].filter(Boolean).join('\n');

  await upsertIssueComment({
    github,
    context,
    issueNumber: pr.number,
    marker: PR_TRAIL_MARKER,
    body,
    comments,
  });
}

module.exports = {
  handleIssueEvent,
  handlePullRequestEvent,
};
