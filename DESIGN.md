# Design system

This is the living reference for Cesco Blog's interface: what the design system
is today, which components exist, and where each one lives.

It describes **what**. The [Architecture Decision Records](docs/adr/README.md)
describe **why**, including the alternatives that were rejected. Each section
below links to the ADR that governs it rather than repeating its reasoning. Where
a component reads a specific column, it links to the
[database schema](docs/database/schema.md).

Status: this document specifies the system. Almost none of it is implemented yet
— see [Debt and open questions](#debt-and-open-questions).

---

## Principles

Cesco Blog is a bilingual editorial site about video game analysis and opinion.
Three properties of that shape every decision here:

1. **It is read, not operated.** Readers arrive for long-form text. The interface
   should get out of the way, and pages should be legible before anything
   finishes loading.
2. **It runs on a tight budget.** Cloudflare Workers free tier allows ~10 ms CPU
   per request ([ADR-0016](docs/adr/0016-host-blog-on-checkpoint-subdomain.md)).
   Rendering counts against it; waiting on the database does not.
3. **Every surface exists twice.** Spanish and English are independent
   publications ([ADR-0008](docs/adr/0008-adopt-bilingual-localized-publishing.md)),
   so no component may assume its counterpart exists.

### Tokens

All color comes from the semantic tokens in `src/styles/global.css`, defined for
both `:root` and `.dark`. **No component hardcodes a color.** This is what makes
dark mode free: a component styled with `bg-card text-card-foreground` is correct
in both themes without any per-component work.

| Token group                        | Purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| `background` / `foreground`        | Page surface and default text                     |
| `card` / `card-foreground`         | Raised surfaces: post cards, metadata panels      |
| `popover` / `popover-foreground`   | Floating surfaces: menus, tooltips                |
| `primary` / `secondary` / `accent` | Actions and emphasis                              |
| `muted` / `muted-foreground`       | De-emphasized text: dates, reading time, captions |
| `destructive`                      | Errors only                                       |
| `border` / `input` / `ring`        | Edges and focus                                   |

The radius scale derives from a single `--radius` (`0.625rem`), exposed as
`--radius-sm` through `--radius-4xl`. Use the scale; do not write pixel radii.

`--chart-1` through `--chart-5` are unused today and reserved.

### Typography

Governed by
[ADR-0021](docs/adr/0021-define-editorial-typography-and-component-boundaries.md).

| Role                        | Font         | Token            |
| --------------------------- | ------------ | ---------------- |
| `h1`–`h3`, post card titles | Merriweather | `--font-heading` |
| Body copy, UI, navigation   | Figtree      | `--font-sans`    |

Both are already installed and imported. The heading rule is specified but **not
yet applied** — `global.css` currently sends everything through `font-sans`.

---

## Rendering model

Governed by
[ADR-0019](docs/adr/0019-render-astro-first-with-react-islands-for-behavior.md).

**A component is `.astro` unless it needs client-side JavaScript, or unless it
must compose inside a React island.**

This section governs **public surfaces only**. Everything under `/admin` is
client-rendered React by
[ADR-0023](docs/adr/0023-treat-the-admin-as-a-client-rendered-application.md) —
see [Admin surfaces](#admin-surfaces).

A common misreading to get out of the way first: a React component **without** a
`client:*` directive is server-rendered to HTML and ships **no** JavaScript. Only
a hydration directive creates an island. There are four options, not two:

| Approach                                       | Client JS         | Server CPU                                       |
| ---------------------------------------------- | ----------------- | ------------------------------------------------ |
| `.astro` component                             | none              | **Lowest** — compiled string template            |
| `.tsx` without `client:*`                      | none              | **Higher** — `react-dom/server` renders the tree |
| `.tsx` with `client:load` / `idle` / `visible` | React + component | **Same server render** + client hydration        |
| `.tsx` with `client:only`                      | React + component | **None** — server rendering skipped              |

A hydrated island is server-rendered **as well as** shipped, not instead of.
React's `hydrateRoot()` attaches to existing markup rather than building the DOM,
so the server HTML has to be there — and it is what the reader sees until the
bundle arrives, which under `client:visible` may be a long time or never.

`client:only` is the one directive that skips the server render. It is not used
in this project: it trades the saving for empty markup until JavaScript executes,
layout shift when it does, and nothing for non-JS crawlers.

So the reason to prefer `.astro` is **server CPU, not client bytes**. Both of the
first two ship nothing; `.astro` is simply the cheaper way to produce identical
HTML under the ~10 ms budget. That difference matters most where components
repeat — a listing rendering twenty `PostCard`s — and least for one-offs.

The size of that difference has not been measured yet; see
[Debt and open questions](#debt-and-open-questions).

Where a primitive is used only for styling, importing its `cva` export skips the
React render altogether:

```astro
---
import { buttonVariants } from '@/components/ui/button';
---

<a href={href} class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
  <slot />
</a>
```

This is the right pattern regardless of performance — it styles an anchor as a
button instead of rendering a `<button>` where a link belongs.

Adding a React **island** is a decision that must be justified in the table
below. If a component's only interactivity is navigation, it is a link.

---

## Component ownership

Governed by
[ADR-0021](docs/adr/0021-define-editorial-typography-and-component-boundaries.md).

| Ownership                  | Destination                 |
| -------------------------- | --------------------------- |
| Registry primitive         | `src/components/ui/`        |
| Reusable product component | `src/components/common/`    |
| Feature-specific component | `src/components/<feature>/` |
| Admin component            | `src/components/admin/`     |
| Route composition          | `src/pages/`                |
| Theme token                | `src/styles/global.css`     |

Dependencies flow one way: **feature → common → ui**, and **admin → common →
ui**. Never edit a primitive to add product behavior — wrap it from `common/`,
because the next registry update reverts local edits.

`common/` must never import from `admin/`. Astro splits bundles by route, but a
single careless shared import can drag the editor into a public page — see
[ADR-0023](docs/adr/0023-treat-the-admin-as-a-client-rendered-application.md).

### Registries

Governed by
[ADR-0020](docs/adr/0020-extend-shadcn-with-base-ui-compatible-registries.md).
This project uses **Base UI**, not Radix.

| Registry                         | Status                            |
| -------------------------------- | --------------------------------- |
| `@shadcn`                        | Configured                        |
| [Coss UI](https://coss.com/ui)   | To add — built on Base UI         |
| [ReUI](https://reui.io)          | To add — **Base UI variant only** |
| [chanhdai](https://chanhdai.com) | Rejected — audited, see below     |

**No component that pulls in `@radix-ui/*` enters this project.**

---

## Global chrome

| Component    | Location  | Type     | Contents                                                                                                                            |
| ------------ | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader` | `common/` | `.astro` | Wordmark, section nav, locale switcher, theme toggle, search entry                                                                  |
| `SiteFooter` | `common/` | `.astro` | Trust page links ([ADR-0018](docs/adr/0018-adopt-privacy-first-analytics-and-defer-monetization.md)), per-language RSS, attribution |

The header is static markup; only the toggle, mobile nav, and search entry within
it are islands.

---

## Public surfaces

Routes from
[ADR-0004](docs/adr/0004-use-cloudflare-cache-for-isr-like-publishing.md). Each
surface declares its composition top to bottom, the primitives it uses and in
which mode, its islands, and the tables it reads.

Every surface below filters on `posts.editorial_state = 'active'` **and**
`post_localizations.status = 'published'`. That is assumed rather than repeated.

### Editorial home — `/es`, `/en`

`SiteHeader` → featured `PostCard` (large variant, one per locale) →
`SectionHeading` "Latest" → `PostCard` grid → `SectionHeading` per section →
`PostCard` row → `SiteFooter`

- **Primitives:** `card` (cva), `badge` (cva), `separator` (cva)
- **Islands:** none beyond global chrome
- **Data:** `post_localizations` ordered by `first_published_at DESC`,
  `featured_at` for the featured slot, `posts.cover_media_id`, `authors`
- **Empty:** `EmptyState` when a locale has no published posts — a real case
  early on, since locales publish independently

### Full listing — `/es/blog`, `/en/blog`

`SiteHeader` → `SectionHeading` → `PostCard` list → `Pagination` → `SiteFooter`

- **Primitives:** `card` (cva), `badge` (cva), `pagination` (cva)
- **Islands:** none
- **Data:** paginated `post_localizations` by `first_published_at DESC`
- **Constraint:** one joined query per page, never one per card — D1 allows 50
  queries per invocation ([ADR-0016](docs/adr/0016-host-blog-on-checkpoint-subdomain.md))

### Section — `/es/analisis`, `/es/opiniones` + EN

Same as full listing, filtered by `posts.section`. `SectionHeading` carries the
section description.

- **Data:** adds `posts.section` to the filter

### Article detail — `/es/analisis/[slug]` + EN

`SiteHeader` → `Breadcrumb` → `CoverImage` → `h1` → `Byline` → `ReadingTime` →
`DisclosureNotice` _(analysis with a review copy only)_ → `TableOfContents`
_(aside on desktop, collapsed above content on mobile)_ → `ArticleBody` →
`AnalysisMetaPanel` _(analysis only)_ → `TagPill` list → `SeriesNav` _(only if
the post belongs to a collection)_ → `CopyLinkButton` → `SiteFooter`

- **Primitives:** `breadcrumb` (cva), `badge` (cva), `separator` (cva), `avatar`
  (cva), `scroll-area` (React, only when the TOC is long)
- **Islands:** `TocScrollSpy` (`client:idle`), `CopyLinkButton`
  (`client:visible`)
- **Table of contents:** the two presentations are **separate markup**, not one
  tree restyled at a breakpoint. A single `<details>` forced open on desktop
  renders correctly and still never enters WebKit's accessibility tree, so the
  outline would be on screen and invisible to a screen reader at once. Each
  viewport gets the markup that is honest for it and `display: none` removes the
  other. The mobile collapse is a native `<details>`, so it works with no
  JavaScript at all.
- **Data:** `post_localizations`, the published `post_revisions` row,
  `posts.cover_media_id`, `authors`, `post_analysis_metadata`,
  `post_revision_media` for inline placements, `post_tags`, `collection_posts`
- **Rules:** `Byline` dates are visible; `DisclosureNotice` renders rather than
  merely existing; TOC anchors come from `content_json` block IDs

### Game page — `/es/juegos/[slug]` + EN

`SiteHeader` → `h1` (game title) → `GameFactsPanel` → `Tabs` (analysis / opinion)
→ `PostCard` list per tab → `SiteFooter`

- **Primitives:** `card` (cva), `badge` (cva) for platforms and genres, `tabs`
  (React, server-rendered without a directive)
- **Islands:** none — tabs render every panel; navigation is not interaction
- **Data:** `games`, `game_platforms`, `game_genres`, posts joined through
  `posts.game_id`

### Tag page — `/es/etiquetas/[slug]` + EN

`SiteHeader` → `SectionHeading` (tag name) → `PostCard` list → `Pagination` →
`SiteFooter`

- **Primitives:** `card` (cva), `pagination` (cva), `badge` (cva)
- **Data:** `tags`, `post_tags`

### Series — `/es/series/[slug]` + EN

`SiteHeader` → `CollectionHeader` (title, description, post count) → ordered
`PostCard` list → `SiteFooter`

- **Primitives:** `card` (cva), `separator` (cva)
- **Data:** `collections`, `collection_localizations`, `collection_posts` ordered
  by `position` — **not** by date; a series has an authored order
- **Rules:** the collection localization must itself be published; see
  [ADR-0010](docs/adr/0010-define-public-url-lifecycle-for-localized-posts.md)

### Trust pages — 5 routes × 2 locales

`SiteHeader` → `Prose` → `SiteFooter`

- **Primitives:** none
- **Data:** none — static content
- **Note:** these are what
  [ADR-0018](docs/adr/0018-adopt-privacy-first-analytics-and-defer-monetization.md)
  requires for Discover eligibility, so they must be reachable from the footer on
  every page

### Error states — `404` and `410`

`SiteHeader` → `ErrorState` → `SiteFooter`

Two distinct pages with distinct copy, per
[ADR-0010](docs/adr/0010-define-public-url-lifecycle-for-localized-posts.md):

| Status | Meaning                   | Copy direction                              |
| ------ | ------------------------- | ------------------------------------------- |
| `404`  | Never existed             | Offer navigation: sections, latest posts    |
| `410`  | Existed and was withdrawn | Say so plainly; do not imply it will return |

A `410` that reads like a `404` wastes the distinction the schema pays for.

`/es/buscar` and `/en/search` are deferred; see
[Debt and open questions](#debt-and-open-questions).

---

## Registry primitives

Installed into `src/components/ui/`. **Consumed as** indicates whether the
component ships React or is used only through its `cva` export from `.astro`.

| Primitive                | Consumed as      | Justified by                                      |
| ------------------------ | ---------------- | ------------------------------------------------- |
| `button`                 | Both — installed | Actions; `buttonVariants` for static links        |
| `card`                   | `cva` only       | `PostCard`, `AnalysisMetaPanel`, `GameFactsPanel` |
| `badge`                  | `cva` only       | Section labels, platform, completion state        |
| `separator`              | `cva` only       | Article and footer dividers                       |
| `avatar`                 | `cva` only       | `Byline`                                          |
| `breadcrumb`             | `cva` only       | Article and series navigation                     |
| `pagination`             | `cva` only       | All listing surfaces                              |
| `skeleton`               | `cva` only       | Reserved; content is server-rendered              |
| `tooltip`                | React            | Icon-only controls in the header                  |
| `menu` / `dropdown-menu` | React            | Locale switcher, share menu                       |
| `dialog`                 | React            | Mobile navigation                                 |
| `drawer`                 | React            | Mobile navigation, small viewports                |
| `scroll-area`            | React            | Long table of contents                            |
| `tabs`                   | React            | Game page: analysis vs opinion                    |
| `command`                | React            | Search — deferred                                 |

"React" in the column above means the component is rendered as React. It does
**not** imply hydration — only the five islands listed under
[Product components](#product-components) carry a `client:*` directive. A
`tooltip` or `tabs` used without one is server-rendered HTML with no JavaScript.

Most primitives are consumed through `cva` only. That is the intended ratio, not
an oversight.

---

## Product components

| Component                  | Location      | Type       | Notes                                                                              |
| -------------------------- | ------------- | ---------- | ---------------------------------------------------------------------------------- |
| `PostCard`                 | `common/`     | `.astro`   | Cover, section badge, title, excerpt, date, reading time                           |
| `Byline`                   | `common/`     | `.astro`   | Author, publication and modification dates — **visible**, not only structured data |
| `ReadingTime`              | `common/`     | `.astro`   | Reads `post_revisions.reading_time_minutes`                                        |
| `TagPill`                  | `common/`     | `.astro`   | Links to the tag surface                                                           |
| `CoverImage`               | `common/`     | `.astro`   | Reads `posts.cover_media_id`; emits width/height                                   |
| `Prose`                    | `common/`     | `.astro`   | Typographic wrapper for long-form content                                          |
| `SectionHeading`           | `common/`     | `.astro`   | Listing and home section headers                                                   |
| `EmptyState`               | `common/`     | `.astro`   | Listing with no results                                                            |
| `ErrorState`               | `common/`     | `.astro`   | Distinct copy per status code                                                      |
| `SiteHeader`, `SiteFooter` | `common/`     | `.astro`   | See [Global chrome](#global-chrome)                                                |
| `ArticleBody`              | `post/`       | `.astro`   | Renders `content_json` blocks and inline media                                     |
| `TableOfContents`          | `post/`       | `.astro`   | Anchors from `content_json` block IDs, never from heading text                     |
| `DisclosureNotice`         | `post/`       | `.astro`   | Review-copy disclosure, rendered visibly                                           |
| `AnalysisMetaPanel`        | `post/`       | `.astro`   | Platform, playtime, completion state                                               |
| `GameFactsPanel`           | `game/`       | `.astro`   | Developer, publisher, release date, platforms, genres                              |
| `CollectionHeader`         | `collection/` | `.astro`   | Series title, description, post count                                              |
| `SeriesNav`                | `collection/` | `.astro`   | Previous/next within the series                                                    |
| `TocScrollSpy`             | `post/`       | **island** | `IntersectionObserver` over headings — `client:idle`, see the note below           |
| `CopyLinkButton`           | `post/`       | **island** | `navigator.clipboard` — `client:visible`                                           |
| `ThemeToggle`              | `nav/`        | **island** | `localStorage` — `client:load`                                                     |
| `MobileNav`                | `nav/`        | **island** | Focus trap, keyboard dismissal — `client:idle`                                     |
| `LocaleSwitcher`           | `nav/`        | **island** | `client:idle`; stays `.astro` if it is only a link                                 |

Five islands. Everything else ships no JavaScript.

**An island that renders `null` cannot use `client:visible`.** The directive
observes the island's own placeholder, and a component returning nothing leaves
one with no box — so the observer never fires and the island never hydrates.
Nothing errors; the behaviour is simply absent. `TocScrollSpy` shipped this way
and its highlight never worked once. Islands that decorate other elements rather
than render their own take `client:idle`.

This table covers **public** components only. Admin components live in
`src/components/admin/`, are always `.tsx`, and are listed under
[Admin surfaces](#admin-surfaces).

---

## Admin surfaces

Governed by
[ADR-0023](docs/adr/0023-treat-the-admin-as-a-client-rendered-application.md):
everything under `/admin` is **client-rendered React**. The public rules —
`.astro` first, zero JavaScript, CPU budget — do not apply here. Components live
in `src/components/admin/` and are `.tsx`.

Routes from [ADR-0003](docs/adr/0003-protect-admin-with-cloudflare-access.md),
including its route-model extension.

| Route                    | Purpose                                                             | Writes                                                                       |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/admin`                 | Dashboard: drafts in progress, unpublished locales, recent activity | —                                                                            |
| `/admin/posts`           | Post list with locale status per row, featuring controls            | `post_localizations.featured_at`, `posts.editorial_state`                    |
| `/admin/posts/new`       | Create the aggregate and its first localization                     | `posts`, `post_localizations`                                                |
| `/admin/posts/[id]/edit` | Rich text editing — see below                                       | `post_revisions`, `post_revision_media`, `post_analysis_metadata`            |
| `/admin/posts/[id]/seo`  | SEO and social metadata — see below                                 | `post_revisions` SEO/OG fields                                               |
| `/admin/media`           | R2-backed asset library with attribution fields                     | `media_assets`                                                               |
| `/admin/review`          | Draft review before publishing; publish action                      | `post_localizations` status and timestamps, `post_localization_slug_history` |
| `/admin/collections`     | Series list and ordering                                            | `collections`, `collection_localizations`, `collection_posts`                |
| `/admin/authors`         | Author profiles for bylines and structured data                     | `authors`                                                                    |

### `/admin/posts/[id]/edit`

The editor. Governed by
[ADR-0024](docs/adr/0024-adopt-tiptap-for-the-editorial-content-pipeline.md).

| Component              | Role                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `LocalizationSwitcher` | Selects which localization is being edited — a revision belongs to **one** localization, not to the post |
| `EditorToolbar`        | Base UI buttons wired to Tiptap commands; Tiptap ships no UI                                             |
| `EditorCanvas`         | The Tiptap instance                                                                                      |
| `ImageUploadHandler`   | Paste and drop → admin upload endpoint → R2 → `media_assets` row → node gets `mediaAssetId`              |
| `MediaPlacementPanel`  | Per-placement `alt_text`, `caption`, `credit_override` — the columns `post_revision_media` already has   |
| `AnalysisMetaForm`     | Platform (FK to `platforms`), playtime, completion state, review-copy flag and provider                  |
| `SlugField`            | Editing a **published** slug triggers the history flow, not a plain update                               |

On save, the `content_json` is walked to collect image nodes and upsert
`post_revision_media` rows with their `block_id`, `position`, and
`media_asset_id`. Reading time and TOC are derived through the shared module.

### `/admin/posts/[id]/seo`

Long form: SEO title and description, canonical URL, OG title and description,
OG image selector against `media_assets`, and a **social card preview**.

The form must make the distinction from
[ADR-0015](docs/adr/0015-separate-social-card-from-editorial-cover-image.md)
visible, because it is the one place a person could get it wrong:

- `posts.cover_media_id` is the clean editorial image. It feeds JSON-LD `image`,
  the article hero, and Google Discover.
- `post_revisions.og_image_media_id` is the composed card with burned-in text. It
  feeds `og:image` only.
- **Publishing is blocked without a cover.** The OG card is optional and falls
  back to the cover.

### `/admin/review`

The publish surface, and the one with the most rules behind a single button:

- Sets `first_published_at` if unset, and **never** overwrites or clears it
- Updates `current_published_at`
- Moves `published_revision_id`
- Purges the affected cache tags per
  [ADR-0011](docs/adr/0011-invalidate-cloudflare-cache-by-cache-tag.md) —
  including the **other locale's** page, whose `hreflang` just changed
- Refuses to publish a post with no cover image

---

## Dependencies

Everything that does not come from a component registry, grouped by where it
runs. The right column is what has to be **adapted** — none of these arrive
matching the design system.

| Scope        | Dependency                               | Purpose and adaptation                                                                                                                                                                                                    |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin        | `@tiptap/react`, `@tiptap/starter-kit`   | Editor core. Headless — the entire toolbar and menus are ours to build from Base UI components                                                                                                                            |
| Admin        | `@tiptap/extension-unique-id`            | Stable node IDs that survive split, merge, and undo. These **are** `post_revision_media.block_id`                                                                                                                         |
| Admin        | Custom Tiptap image node                 | Stores `mediaAssetId` on the node; not a package, ours to write                                                                                                                                                           |
| Admin        | `zod`                                    | Form and payload validation. Error messages must be localized — Zod's defaults are English                                                                                                                                |
| Admin        | `react-hook-form`, `@hookform/resolvers` | Form state and per-field errors. shadcn's `form` component already assumes this pairing                                                                                                                                   |
| Shared       | `content_json` Zod schema                | The contract between the editor, the seed script, and `ArticleBody`. Ours to write; lives outside `admin/` so all three can import it                                                                                     |
| Shared       | Reading time + TOC module                | Derived at publish, per [ADR-0012](docs/adr/0012-extend-editorial-schema-for-authors-series-and-analysis.md) and [ADR-0017](docs/adr/0017-bootstrap-content-with-seed-script.md). Shared by the seed script and the admin |
| Admin        | Browser canvas APIs                      | Resize and convert to WebP before upload ([ADR-0028](docs/adr/0028-normalize-and-validate-media-uploads-before-storage.md)). Native; no package                                                                           |
| Shared       | `src/i18n/`                              | Typed string dictionary, no dependency ([ADR-0027](docs/adr/0027-localize-ui-strings-with-a-typed-dictionary.md)). English is typed against Spanish, so a missing key is a compile error                                  |
| Shared       | `src/lib/ids.ts`                         | `crypto.randomUUID()` wrappers ([ADR-0026](docs/adr/0026-generate-identifiers-with-crypto-randomuuid.md)). Native in Worker, Node, and browser                                                                            |
| Shared       | `src/lib/timestamps.ts`                  | Canonical date format for text columns ([ADR-0029](docs/adr/0029-store-timestamps-in-sqlite-current-timestamp-format.md)). Deliberately not ISO                                                                           |
| Shared       | `src/lib/runtime.ts`                     | The only place application code touches `locals.runtime.env`                                                                                                                                                              |
| Publish-time | Shiki                                    | Code highlighting, run **when publishing**, result stored in the code node. Never at render time                                                                                                                          |
| Public       | `Intl.DateTimeFormat`                    | Bilingual dates with no dependency. Receives the locale from the URL, not from the browser                                                                                                                                |
| Public       | —                                        | **No package.** That is the point of [ADR-0019](docs/adr/0019-render-astro-first-with-react-islands-for-behavior.md)                                                                                                      |
| Tooling      | `@cloudflare/vitest-pool-workers`        | D1 integration tests inside workerd ([ADR-0025](docs/adr/0025-test-d1-through-the-workers-vitest-pool.md)). Dev dependency; never shipped                                                                                 |

Two rules that keep this list from leaking:

1. **No admin dependency may be imported from a public surface.** The permitted
   direction is `admin → common → ui`. `common/` must not import from `admin/`.
2. **Shared modules must not import Tiptap.** The `content_json` schema and the
   derivation module are consumed by the Worker at render time; pulling the
   editor in behind them would ship it to readers.

---

## Content rules the UI must honor

These come from decisions already made. A design change that breaks one of them
is a change to that ADR, not a styling choice.

| Rule                                                                                    | Source                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Byline and dates are **visible on the page**, not only in JSON-LD                       | [ADR-0013](docs/adr/0013-define-server-first-seo-metadata-contract.md)                                                                               |
| Review-copy disclosure is **rendered visibly**; storing it is not enough                | [ADR-0012](docs/adr/0012-extend-editorial-schema-for-authors-series-and-analysis.md)                                                                 |
| `LocaleSwitcher` offers only **published** locales; a draft counterpart is not linked   | [ADR-0010](docs/adr/0010-define-public-url-lifecycle-for-localized-posts.md), [ADR-0013](docs/adr/0013-define-server-first-seo-metadata-contract.md) |
| Hero and card images come from `cover_media_id`, never from the burned-text social card | [ADR-0015](docs/adr/0015-separate-social-card-from-editorial-cover-image.md)                                                                         |
| Listings and feeds order by `first_published_at DESC`                                   | [ADR-0014](docs/adr/0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)                                                                              |
| `404` and `410` are distinct pages with distinct copy                                   | [ADR-0010](docs/adr/0010-define-public-url-lifecycle-for-localized-posts.md)                                                                         |
| TOC anchors derive from block IDs so headings can be reworded                           | [ADR-0012](docs/adr/0012-extend-editorial-schema-for-authors-series-and-analysis.md)                                                                 |
| Cached responses carry their `Cache-Tag` set                                            | [ADR-0011](docs/adr/0011-invalidate-cloudflare-cache-by-cache-tag.md)                                                                                |
| A listing composes with **one joined query**; D1 allows 50 per invocation               | [ADR-0016](docs/adr/0016-host-blog-on-checkpoint-subdomain.md)                                                                                       |

---

## Motion

Governed by
[ADR-0022](docs/adr/0022-adopt-css-only-motion-with-shared-easing-scale.md).
No JavaScript animation library. `tw-animate-css` is already installed.

| Situation                            | Easing        | Duration   |
| ------------------------------------ | ------------- | ---------- |
| Entering or leaving the screen       | `ease-out`    | 150–250 ms |
| On-screen element moving or morphing | `ease-in-out` | 200–300 ms |
| Hover and color change               | `ease`        | 100–150 ms |
| Constant motion                      | `linear`      | —          |

`ease-in` is not used.

Rules that apply everywhere:

- Animate only `transform` and `opacity`.
- Nothing exceeds 300 ms; exits run ~20% faster than entrances.
- Paired elements share identical easing and duration.
- Enter from `scale(0.95)`, never `scale(0)`.
- Every animation carries `@media (prefers-reduced-motion: reduce)`.
- Hover effects sit inside `@media (hover: hover) and (pointer: fine)`.
- High-frequency controls — primary nav, body links — are not animated.

Where motion is used:

| Surface                | Motion                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| Mobile nav             | Drawer slide + overlay fade, shared timing                            |
| Dropdowns, tooltips    | Fade + `scale(0.95)` from the trigger's `transform-origin`            |
| Theme toggle           | Icon crossfade only                                                   |
| Post card hover        | Subtle cover scale, desktop pointers only                             |
| Page navigation        | Native CSS View Transitions, `@view-transition { navigation: auto; }` |
| Article body, listings | **None.** Content does not animate in.                                |

---

## Performance budget

| Surface                     | JS shipped                                  |
| --------------------------- | ------------------------------------------- |
| Article detail              | Theme toggle + TOC scroll-spy + copy button |
| Listings, home, tag, series | Theme toggle only                           |
| Trust pages                 | Theme toggle only                           |
| `404` / `410`               | Theme toggle only                           |

Every page also carries the small blocking inline theme script that prevents a
flash of the wrong theme — the one deliberate exception in
[ADR-0019](docs/adr/0019-render-astro-first-with-react-islands-for-behavior.md).

**`/admin` is exempt from this budget entirely.** It sits behind Cloudflare
Access, is never indexed, and serves one authenticated user, so none of the
reasons for the budget apply. That exemption is the whole point of
[ADR-0023](docs/adr/0023-treat-the-admin-as-a-client-rendered-application.md) —
and it is also why the admin bundle must never leak into a public route.

LCP on the article page is the cover image. It needs explicit dimensions from
`media_assets.width`/`height` to avoid layout shift. A concrete LCP target is
still to be set.

---

## Debt and open questions

Resolved in the pre-implementation phase: component folders now exist and
`home-hero.tsx` sits in `common/`; identifiers, UI strings, timestamps, runtime
access, and the D1 test harness are in place.

- **`--font-heading` is still inert.** Merriweather is installed and tokenized,
  but no selector consumes it; everything renders in Figtree until the rule lands
  in `@layer base`.
- **`chanhdai` TOC Minimap: audited and rejected.** Its registry entry declares
  `registryDependencies: ["hover-card", "@soundcn/u-mini-map-open"]` — the second
  is a **sound**, played through `useSound` when the card opens. Independently of
  that, it is built on hover, which does not exist on touch, so it cannot answer
  the mobile problem it was suggested for. The Theme Toggle Effect from the same
  registry is still unaudited and needs the same check before use.
- **Search is unspecified.** `/es/buscar` and `/en/search` depend on indexing
  decisions that have not been made.
- **No LCP target.** The budget above names the metric but not the number.
- **The `.astro` preference is unmeasured.** Rendering through `react-dom/server`
  costs more CPU than a compiled Astro template, but by how much is unknown.
  Benchmark twenty `PostCard`s both ways inside the Worker. If the gap is
  negligible at this scale, the rule becomes a convention rather than a
  performance requirement and
  [ADR-0019](docs/adr/0019-render-astro-first-with-react-islands-for-behavior.md)
  should be amended.
- **Dark mode has no toggle yet.** The `.dark` variant and its full token set
  exist in `global.css`; nothing activates them.
- **Reading-time and TOC generation is unwritten.** The columns exist
  ([schema](docs/database/schema.md)); the shared module that fills them is part
  of the seed script work in
  [ADR-0017](docs/adr/0017-bootstrap-content-with-seed-script.md).
- **Editor autosave is undesigned.** Revisions are immutable, so every save
  creating a revision would flood the table, while saving only on demand risks
  losing work. The draft-versus-revision boundary needs deciding before the
  editor is built.
- **No bundle guard.** Nothing detects an admin import leaking into a public
  route. That boundary is currently a convention, and a size check on the public
  bundles would make it enforceable.
- **The slug-change flow has no interface.** The rules exist
  ([ADR-0010](docs/adr/0010-define-public-url-lifecycle-for-localized-posts.md))
  but no surface presents them: renaming a published slug must write history,
  rewrite prior rows, and warn that the old URL becomes a redirect.
- **Shiki theming is a one-way door.** Highlighted output is stored inside
  `content_json`, so changing the theme later means reprocessing published
  revisions.
