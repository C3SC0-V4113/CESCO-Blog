---
name: react-doctor
description: Use when finishing a React feature, fixing React code, before committing, or when asked to run React Doctor diagnostics.
---

# React Doctor

Run React Doctor after React code changes and before completion:

```bash
pnpm dlx react-doctor@latest --verbose --diff
```

Use the project scripts for blocking validation:

```bash
pnpm run doctor
```

If the score regresses or warnings appear, fix them before claiming completion.
