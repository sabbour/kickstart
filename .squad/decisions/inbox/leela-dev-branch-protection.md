# Dev Branch Protection Rules Setup

## Attempt Summary
Attempted to set up branch protection rules on `dev` branch via GitHub REST API to enforce the PR ceremony workflow.

## Configuration Identified
- **Branch**: `dev` (confirmed to exist, currently unprotected)
- **Required Status Check**: "CI Gate" (from ci.yml workflow job)
- **Intended Rules**:
  - Require 1 PR approval
  - Require "CI Gate" status check to pass
  - Block force pushes
  - Block deletions
  - Do NOT require conversation resolution
  - No admin enforcement needed

## Blocker: Admin Access Required
Branch protection rules require **admin permissions** on the repository. Current user `asabbour_microsoft` has:
- ✅ pull, push, triage
- ❌ admin (required for branch protection)
- ❌ maintain

## Resolution Required
This task must be completed by a repository admin. The exact API call needed:

```bash
gh api PUT /repos/azure-management-and-platforms/kickstart/branches/dev/protection \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -f required_status_checks='{"strict":false,"contexts":["CI Gate"]}' \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

Or via curl with proper JSON:
```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/azure-management-and-platforms/kickstart/branches/dev/protection \
  -d '{
    "required_status_checks": {"strict": false, "contexts": ["CI Gate"]},
    "enforce_admins": false,
    "required_pull_request_reviews": {"required_approving_review_count": 1},
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

## Decision Requested
- Assign an admin to apply these branch protection rules to `dev`
- Rules are ready to be applied immediately
