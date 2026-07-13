---
name: project-min-evaluation
description: Run the minimum local quality checks before marking implementation work complete.
---

# Project Minimum Evaluation

Run these commands from the repository root before reporting completion:

```bash
pnpm run lint
pnpm run typecheck
pnpm run format:check
pnpm run test
pnpm run doctor
pnpm run check
```

If E2E behavior changed, also run `pnpm run test:e2e`.

If a check fails or cannot run, report the exact command, exact error, and unverified scope.
