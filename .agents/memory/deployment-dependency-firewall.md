---
name: Deployment dependency firewall
description: Dependency updates needed when deployment package installation is blocked by a vulnerable transitive package.
---

When a deployment fails during `npm install` with a generic npm exit-handler error, inspect the first blocked package and trace which direct dependency brings it in. Update that direct dependency to a safe current release rather than bypassing the package firewall.

**Why:** The deployment environment can reject a vulnerable transitive package before the application build starts, even when local TypeScript checks and production builds pass.

**How to apply:** Re-run a clean `npm ci` after the update, then run the project checks and build before pushing. Stage only intended source and lockfile changes; do not include uploaded diagnostic screenshots unless requested.