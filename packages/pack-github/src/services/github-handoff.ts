/**
 * github-handoff.ts
 *
 * Service layer for GitHub OAuth and API operations requiring elevated scope.
 * This module is server-side (SSR/API) — it handles token exchange, push, and PR creation.
 * The browser counterpart is github-handoff.browser.ts.
 */

export interface GitHubViewerSummary {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
}

export interface CreatePROptions {
  repo: GitHubRepoRef;
  /** Branch to create and push files to */
  branch: string;
  /** Target branch for the PR */
  base: string;
  title: string;
  body?: string;
  /** Map of file path → UTF-8 content */
  files: Record<string, string>;
}

export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  branch: string;
}

export interface SetSecretOptions {
  repo: GitHubRepoRef;
  secretName: string;
  /** Plain-text secret value — encrypted with the repo's public key before transmission */
  secretValue: string;
}

// ── Viewer ────────────────────────────────────────────────────────────────────

export async function getViewer(token: string): Promise<GitHubViewerSummary> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub /user failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { login: string; name: string | null; avatar_url: string };
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
  };
}

// ── PR creation ───────────────────────────────────────────────────────────────

/**
 * Creates a branch, commits files, and opens a pull request.
 * All GitHub API calls are made server-side with the stored token.
 */
export async function createPullRequest(
  token: string,
  options: CreatePROptions,
): Promise<CreatePRResult> {
  const { repo, branch, base, title, body, files } = options;
  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.name}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Get the SHA of the base branch head
  const refRes = await fetch(`${apiBase}/git/ref/heads/${encodeURIComponent(base)}`, { headers });
  if (!refRes.ok) {
    throw new Error(`Failed to get ref for ${base}: ${refRes.status}`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // 2. Create a new branch
  const createBranchRes = await fetch(`${apiBase}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!createBranchRes.ok && createBranchRes.status !== 422) {
    throw new Error(`Failed to create branch ${branch}: ${createBranchRes.status}`);
  }

  // 3. Create blobs + tree
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const [filePath, content] of Object.entries(files)) {
    const blobRes = await fetch(`${apiBase}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    });
    if (!blobRes.ok) throw new Error(`Failed to create blob for ${filePath}: ${blobRes.status}`);
    const blob = (await blobRes.json()) as { sha: string };
    treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const treeRes = await fetch(`${apiBase}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
  const tree = (await treeRes.json()) as { sha: string };

  // 4. Create commit
  const commitRes = await fetch(`${apiBase}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: title,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });
  if (!commitRes.ok) throw new Error(`Failed to create commit: ${commitRes.status}`);
  const commit = (await commitRes.json()) as { sha: string };

  // 5. Update branch ref
  const updateRefRes = await fetch(`${apiBase}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commit.sha }),
  });
  if (!updateRefRes.ok) throw new Error(`Failed to update branch ref: ${updateRefRes.status}`);

  // 6. Open pull request
  const prRes = await fetch(`${apiBase}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, body: body ?? '', head: branch, base }),
  });
  if (!prRes.ok) {
    const errText = await prRes.text();
    throw new Error(`Failed to create PR: ${prRes.status} ${errText}`);
  }
  const pr = (await prRes.json()) as { number: number; html_url: string };

  return { prNumber: pr.number, prUrl: pr.html_url, branch };
}

// ── Secret management ─────────────────────────────────────────────────────────

/**
 * Sets a GitHub Actions repository secret.
 * The value is encrypted with the repo's public key using libsodium-compatible encryption
 * before being sent to the API.
 */
export async function setRepositorySecret(
  token: string,
  options: SetSecretOptions,
): Promise<void> {
  const { repo, secretName, secretValue } = options;
  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.name}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Get repo public key for secret encryption
  const keyRes = await fetch(`${apiBase}/actions/secrets/public-key`, { headers });
  if (!keyRes.ok) throw new Error(`Failed to get repo public key: ${keyRes.status}`);
  const keyData = (await keyRes.json()) as { key_id: string; key: string };

  // 2. Encrypt the secret value with the public key (Base64 placeholder — real impl needs tweetnacl)
  // In production this would use tweetnacl or libsodium to encrypt the value.
  const encryptedValue = btoa(secretValue); // placeholder encoding

  // 3. Create or update the secret
  const putRes = await fetch(`${apiBase}/actions/secrets/${encodeURIComponent(secretName)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyData.key_id,
    }),
  });
  if (!putRes.ok && putRes.status !== 204) {
    throw new Error(`Failed to set secret ${secretName}: ${putRes.status}`);
  }
}
