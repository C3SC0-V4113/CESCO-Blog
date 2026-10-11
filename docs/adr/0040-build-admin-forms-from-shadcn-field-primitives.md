# ADR-0040: Build admin forms from shadcn field primitives

**Status:** Accepted — 2026-10-11

## Context

Admin forms used bare native controls and local classes, so field layout,
validation states, and interaction details drifted from the shared design
system. The project already uses shadcn components built on Base UI
([ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)), while
React Hook Form owns the existing validation and submission flow.

## Decision

Admin forms use shadcn `Field`/`FieldGroup`, `Input`, and `Select` primitives
from the Base UI registry. A predefined choice uses the custom shadcn `Select`,
not `NativeSelect`; it is controlled with React Hook Form `Controller` and
retains a `name` so its value remains part of form submission. Labels and errors
use `FieldLabel` and `FieldError`, with `aria-invalid` and
`aria-describedby` preserved on the control.

Add each primitive through the shadcn CLI in the first branch that needs it and
verify generated implementations import Base UI, never Radix
([ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)).

## Consequences

### Positive

- Admin fields share consistent layout, focus, invalid, and disabled styling.
- Select menus have a controllable popup that supports keyboard interaction and
  can be tested through accessible roles.
- React Hook Form remains responsible for validation and focuses invalid
  controls through the Select trigger ref.

### Trade-offs

- Selects require the admin React island to hydrate, so forms remain gated until
  React is ready ([ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md)).
- The custom popup replaces the platform-native mobile picker; its placement
  must stay inside the viewport and is covered by responsive browser tests.
- Browser tests interact with a Select by opening its combobox and choosing an
  option, rather than using native `selectOption`.

## Related Decisions

- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md)
