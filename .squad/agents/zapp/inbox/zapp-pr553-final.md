**Zapp — PR #553 Final Security Recheck**

LRO SSRF fix verification:
- `ARM_POLLING_HOSTS` includes all four ARM clouds: `management.azure.com`, `management.usgovcloudapi.net`, `management.chinacloudapi.cn`, and `management.microsoftazure.de` (`packages/pack-azure/src/services/azure-auth.ts:61-66`).
- `assertArmPollingUrl()` rejects invalid URLs, requires `https:`, and enforces an exact ARM-host allowlist before any token-bearing poll proceeds (`packages/pack-azure/src/services/azure-auth.ts:72-84`).
- `pollArmLro()` calls `assertArmPollingUrl(operationUrl)` before `fetch()`, so the bearer token is gated before forward to the polling target (`packages/pack-azure/src/services/azure-auth.ts:91-105`).
- All three executor tools route 202/LRO handling through `pollArmLro()` — deploy, update, and delete (`packages/pack-azure/src/tools/arm-deploy-resource.ts:69-76`, `packages/pack-azure/src/tools/arm-update-resource.ts:69-76`, `packages/pack-azure/src/tools/arm-delete-resource.ts:66-73`). The shared deployment waiter also inherits the same gate (`packages/pack-azure/src/services/azure-deployments.ts:125-139`).
- Tests cover the requested cases and more: valid ARM URL, `http://` rejected, non-ARM host rejected, invalid URL rejected, gov cloud passes, plus China/Germany allowlist coverage, empty-string rejection, and lookalike-subdomain rejection (`packages/pack-azure/src/tools/lro-polling.test.ts:4-58`).
- Validation evidence: `npm run build -w @kickstart/pack-azure` passed; `npx vitest run packages/pack-azure/src/**/*.test.ts` passed (42/42 tests, including 9/9 LRO polling tests).

**Verdict:** APPROVED ✅
— Zapp (Security Architect)
