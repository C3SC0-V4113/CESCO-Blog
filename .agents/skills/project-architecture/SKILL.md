---
name: project-architecture
description: Generic project architecture and design guardrails. Use when changing UI, layout, component architecture, state flow, theming, or Astro island boundaries.
---

# Project Architecture Guardrails

Use this skill when a change touches UI, component structure, app behavior, theming, or data display.

## Rules

1. Keep Astro server-first unless interactivity requires a React island.
2. Read the current Astro docs before changing framework APIs or project structure.
3. Use Purrfold-installed shared workflow skills when present; rerun `./skills.sh` if they are missing.
4. Respect `DESIGN.md` for visual and UX decisions.
5. Use shadcn primitives and semantic tokens before custom styling.
6. Add tests proportional to risk.

## Pre-Close Checklist

- Did the change add unnecessary client-side surface?
- Does it follow `DESIGN.md`?
- Are loading, empty, and error states explicit?
- Did you run `.agents/skills/project-min-evaluation/SKILL.md` before claiming completion?
