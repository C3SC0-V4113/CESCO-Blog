# ADR-0007: Narrow editorial sections to analysis and opinion

## Status

Accepted

## Context

Cesco Blog previously planned three editorial sections: analysis, opinion, and
guides. The product direction is now more focused: analysis should be the main
editorial surface, while opinion remains the secondary section.

Keeping guides in the planned model would increase route, cache, taxonomy, and
editorial workflow surface before there is a clear product need for it.

## Decision

Remove guides from the planned editorial section model.

The accepted post sections are:

- `analysis`
- `opinion`

The planned public route model no longer includes `/guias` or `/guias/[slug]`.

## Consequences

### Positive

- Keeps the first product scope focused on the strongest editorial formats.
- Reduces planned public route and cache invalidation surface.
- Keeps the post section enum aligned with the current product direction.

### Negative

- Guide-style content will need to be expressed as analysis or opinion for now.
- Reintroducing guides later will require a new decision and route/model update.

## Related decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)
