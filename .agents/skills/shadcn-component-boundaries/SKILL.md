---
name: shadcn-component-boundaries
description: "Trigger: components/ui, shadcn, component placement, common components, feature components, atomic design. Enforce registry and product component boundaries."
license: Apache-2.0
metadata:
  author: purrfold
  version: "1.0"
---

# shadcn Component Boundaries

## Activation Contract

Use this skill when creating, moving, wrapping, or reviewing UI components.

## Hard Rules

1. Read `components.json` or run the installed shadcn skill's project-context command before choosing paths. Never assume whether the project uses `components/` or `src/components/`.
2. Reserve the resolved `ui` directory for registry-managed primitives installed from shadcn or compatible registries.
3. Never place product-owned wrappers, composites, sections, domain components, or feature behavior in the resolved `ui` directory.
4. Put reusable product-owned components in the resolved components directory under `common/`.
5. Put feature-owned components under a named feature folder or colocate them inside that feature.
6. Prefer composition: wrap a registry primitive from `common/` or a feature folder instead of adding product behavior to the primitive.
7. Keep dependency direction one-way: feature → common → ui. The `ui` directory must not import from `common` or feature folders.
8. Use semantic tokens from the global stylesheet. Treat token variables as quarks and registry primitives as foundational atoms; do not force molecule or organism names into directory paths.

## Decision Gates

| Component ownership | Destination |
| --- | --- |
| shadcn or compatible registry primitive | resolved `ui` directory |
| reusable product-owned component | `components/common/` |
| feature-specific component | `components/<feature>/` or feature colocation |
| route or page composition | framework route/page directory |
| theme token | global stylesheet variables |

## Execution Steps

1. Inspect the resolved shadcn paths.
2. Search installed primitives before creating custom markup.
3. Classify ownership and reuse scope.
4. Place the component using the table above.
5. Verify no new product-owned file entered `ui` and no reverse dependency was introduced.

## Output Contract

State the ownership classification and final path for every component created or moved.
