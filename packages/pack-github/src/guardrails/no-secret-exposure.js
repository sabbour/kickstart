/**
 * Blocks LLM output and tool results that contain patterns matching GitHub
 * tokens, OAuth codes, or other credential-like strings.
 */
const SECRET_PATTERNS = [
    /ghp_[A-Za-z0-9]{30,}/, // GitHub personal access token
    /github_pat_[A-Za-z0-9_]{30,}/, // Fine-grained PAT
    /gho_[A-Za-z0-9]{36}/, // GitHub OAuth token
    /ghs_[A-Za-z0-9]{30,}/, // GitHub Actions token
    /ghr_[A-Za-z0-9]{36}/, // GitHub refresh token
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i, // Generic Bearer token
];
function containsSecret(text) {
    return SECRET_PATTERNS.some((re) => re.test(text));
}
function extractText(value) {
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value);
    }
    catch {
        return '';
    }
}
export const noSecretExposureGuardrail = {
    id: 'github/no-secret-exposure',
    appliesTo: ['*'],
    stages: ['output', 'tool'],
    async evaluate(input) {
        let text;
        if (input.stage === 'output') {
            text = input.proposedOutput ?? '';
        }
        else if (input.stage === 'tool') {
            text = extractText(input.toolArgs);
        }
        else {
            return { verdict: 'pass' };
        }
        if (!text)
            return { verdict: 'pass' };
        if (containsSecret(text)) {
            return {
                verdict: 'block',
                reason: 'Response blocked: it appears to contain a GitHub token or credential. ' +
                    'Tokens must never appear in LLM output, SSE payloads, or tool results.',
            };
        }
        return { verdict: 'pass' };
    },
};
//# sourceMappingURL=no-secret-exposure.js.map