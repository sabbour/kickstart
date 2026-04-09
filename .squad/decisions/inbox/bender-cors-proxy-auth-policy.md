# Decision: CORS Proxy Authorization Policy

**Date:** 2026-04-09  
**Author:** Bender  
**Task:** B-16

## Decision

- **ARM proxy** (`/api/arm-proxy/*`): Requires `Authorization` header; returns 401 if absent. ARM tokens are user-scoped and must be supplied by the frontend.
- **GitHub proxy** (`/api/github-proxy/*`): Authorization is optional — unauthenticated requests are allowed (needed for public repo access). Token passed through if present.
- **Pricing proxy** (`/api/pricing-proxy`): No authorization at all — Azure Retail Prices API is fully public.

## Rationale

ARM always requires a token (no public endpoints). GitHub has both public and authenticated endpoints; making auth optional maximizes flexibility without breaking unauthenticated flows. Pricing data is inherently public.

## Implications

- Frontend must supply a valid Azure AD bearer token for ARM calls.
- Rate-limit headers from all three upstreams are forwarded so the frontend can implement backoff.
