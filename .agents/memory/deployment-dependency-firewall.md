---
name: Deployment dependency firewall
description: Dependency updates needed when deployment package installation is blocked by a vulnerable transitive package.
---

When a deployment fails during `npm install` with a generic npm exit-handler error, inspect both the first blocked package and every `resolved` URL in `package-lock.json`. Update vulnerable direct dependencies and ensure the committed lockfile does not contain Replit-only registry URLs.

**Why:** The deployment environment can reject a vulnerable transitive package or fail to resolve a `package-firewall.replit.local` tarball before the application build starts, even when local TypeScript checks and production builds pass.

**How to apply:** Generate the lockfile in a clean directory with the public npm registry and `replace-registry-host=never`, verify there are zero internal resolved URLs, then run a clean `npm ci`, project checks, and build before pushing. Stage only intended source and lockfile changes; do not include uploaded diagnostic screenshots unless requested.