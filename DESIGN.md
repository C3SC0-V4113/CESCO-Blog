# Design system

This is the living reference for Cesco Blog's interface: what the design system
is today, which components exist, and where each one lives.

It describes **what**. The [Architecture Decision Records](docs/adr/README.md)
describe **why**, including the alternatives that were rejected. Each section
below links to the ADR that governs it rather than repeating its reasoning. Where
a component reads a specific column, it links to the
[database schema](docs/database/schema.md).

Status: this document describes the implemented system and its current conventions.

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
| `brand`                            | The accent as text and small glyphs               |
| `muted` / `muted-foreground`       | De-emphasized text: dates, reading time, captions |
| `destructive`                      | Errors only                                       |
| `border` / `input` / `ring`        | Edges and focus                                   |
| `image-outline`                    | Inset hairline on covers and body figures         |

`--primary` is a **fill**: in dark it is chosen for light text on top of it, and
as text it falls to 2.62:1 on the background. Text and small glyphs in the accent
colour use `--brand` (`text-brand`, `hover:text-brand`)
instead: `--primary` in light, `oklch(0.704 0.14 182.503)` in dark, at 8.14:1 on
the background, 7.17:1 on card and 6.10:1 on muted. Buttons and other fills keep
`--primary`.

`--image-outline` is pure black in light and pure white in dark, both at 10%,
drawn as a 1px outline offset by -1px so it sits inside the image's edge
(`outline -outline-offset-1 outline-image-outline`). It replaces a layout border
on covers and body figures. Where the image scales on hover, the outline goes on
a pseudo-element of the clipping frame so the zoom cannot carry it past the clip.

`--muted-foreground` is set for the darkest surface it sits on, not for white:
in light it clears 4.91:1 on `--muted` and 5.46:1 on white, so de-emphasized
text stays at AA in table heads, disclosures and the admin's tinted canvas.

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

Both are installed and imported, and `@layer base` in `global.css` applies
`font-heading` to headings.

The shared type tokens include `text-2xs` (0.6875rem with a 1rem line box),
`text-display` (2.125rem at 1.15 leading), and `text-display-sm` (2.5rem at
1.15 leading). The `eyebrow` utility adds the compact size, medium weight,
letter spacing, and uppercase treatment; callers choose its color with
`text-brand` or `text-muted-foreground`.

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

### Shared variants and lint

Reusable text links use `linkVariants` from
`src/components/ui/link-variants.ts`: `accent`, `admin`, `adminAction`,
`articleTitle`, `footer`, `headerBrand`, `mobileNav`, `nav`, and `foreground`.
The registry `Badge` exposes its `default`, `secondary`, `destructive`,
`outline`, `ghost`, and `link` variants. `Button` owns its interaction states,
including `aria-disabled`; its sizes include 40px `xl` and `icon-xl`, plus the
`tight` spacing used for a compact icon-and-label action. Use `variant="toggle"`
for pressed toolbar buttons.

ESLint enforces the design system with `eslint-plugin-better-tailwindcss` and
`@shadcn/lint`; the policy and intentional exceptions are recorded in
[ADR-0041](docs/adr/0041-enforce-design-system-with-lint.md). The Tailwind
plugin checks canonical and shorthand classes, conflicts, deprecated and
repeated classes, and the text-color token restriction. shadcn lint checks
component restyling, raw colors, arbitrary values, inline styles, unknown
classes, and static class analysis. `src/components/ui/**` is ignored because
it is the vendored registry kit and should remain clean under `shadcn add --diff`.

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

| Route                     | Purpose                                                             | Writes                                                                       |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/admin`                  | Dashboard: drafts in progress, unpublished locales, recent activity | —                                                                            |
| `/admin/posts`            | Post list with locale status per row, featuring controls            | `post_localizations.featured_at`, `posts.editorial_state`                    |
| `/admin/posts/new`        | Create the aggregate and its first localization                     | `posts`, `post_localizations`                                                |
| `/admin/posts/[id]/edit`  | Rich text draft editing — see below                                 | `post_drafts`                                                                |
| `/admin/posts/[id]/seo`   | SEO, social preview, cover, and author assignment — see below       | `post_drafts` SEO/OG fields, `posts.cover_media_id`, `posts.author_id`       |
| `/admin/media`            | R2-backed asset library with attribution fields                     | `media_assets`                                                               |
| `/admin/review`           | Draft review before publishing; publish action                      | `post_localizations` status and timestamps, `post_localization_slug_history` |
| `/admin/collections`      | Series list and creation                                            | `collections`                                                                |
| `/admin/collections/[id]` | Bilingual metadata, lifecycle, membership, and authored ordering    | `collections`, `collection_localizations`, `collection_posts`                |
| `/admin/authors`          | Author profiles for bylines and structured data                     | `authors`                                                                    |

Admin forms use shadcn field primitives on Base UI: `Field` and `FieldGroup`
compose labels, validation, and controls; text controls use `Input`; predefined
choices use the custom `Select`, wired through React Hook Form `Controller`.
Selects keep native form names and values and are tested through their
accessible combobox/listbox roles.

The navigation trigger stays disabled until the admin island hydrates, so an
activation against server-rendered markup is not lost (ADR-0023).

### `/admin/posts/[id]/edit`

The editor is governed by
[ADR-0024](docs/adr/0024-adopt-tiptap-for-the-editorial-content-pipeline.md),
[ADR-0032](docs/adr/0032-separate-drafts-from-revisions.md), and
[ADR-0035](docs/adr/0035-coordinate-draft-autosave-with-compare-and-swap.md).
Media normalization, bounded upload, and R2/D1 compensation follow
[ADR-0036](docs/adr/0036-bound-media-normalization-and-storage.md).

| Component              | Role                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `LocalizationSwitcher` | Selects which existing localization draft is edited; missing locales remain unavailable                |
| `EditorToolbar`        | Base UI buttons wired to Tiptap commands; Tiptap ships no UI                                           |
| `EditorCanvas`         | The Tiptap instance                                                                                    |
| `ImageUploadHandler`   | Paste and drop → admin upload endpoint → R2 → `media_assets` row → node gets `mediaAssetId`            |
| `MediaPlacementPanel`  | Per-placement `alt_text`, `caption`, `credit_override` — the columns `post_revision_media` already has |
| `AnalysisMetaForm`     | Platform (FK to `platforms`), playtime, completion state, review-copy flag and provider                |
| `SlugField`            | Editing a **published** slug triggers the history flow, not a plain update                             |

Core autosave mutates one `post_drafts` row with token compare-and-swap; it never
creates revisions or media placements. Publishing validates the exact reviewed
draft token, creates the immutable revision and media placements atomically, and
derives reading time, TOC, and structured Shiki tokens once. Placements snapshot
the R2 address, dimensions, and visible attribution so mutable asset metadata
cannot rewrite published output (ADR-0037).

### `/admin/posts/[id]/seo`

Long form: SEO title and description, the generated current-localization
canonical URL as a read-only value, OG title and description, OG image selector
against `media_assets`, clean cover and author assignment, and a **social card
preview**. The preview is editorial feedback only; it does not generate an
image or mutate the canonical URL.

The form must make the distinction from
[ADR-0015](docs/adr/0015-separate-social-card-from-editorial-cover-image.md)
visible, because it is the one place a person could get it wrong:

- `posts.cover_media_id` is the clean editorial image. It feeds JSON-LD `image`,
  the article hero, and Google Discover.
- `post_revisions.og_image_media_id` is the optional social image. It feeds
  `og:image` only and falls back to the clean cover when absent.
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
- Commits D1 before cache invalidation and reports a truthful cache-warning
  outcome; the change's tags are recorded with the commit and stay pending until
  a later purge or the review queue's retry drains them (ADR-0037)
- Appends retired slug history without rewriting it; redirect reads join the
  localization's current slug, so A→B→C resolves in one hop (ADR-0038)
- Loads at most eight distinct supported Shiki grammars per publication;
  unknown language names render as plain text and a ninth grammar is rejected
  before highlighting

Production deploys never edit or commit binding identifiers. Operators and CI
provide `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`,
`CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_R2_BUCKET_NAME`,
`CLOUDFLARE_ZONE_ID`, and the Cloudflare Access `ACCESS_TEAM_DOMAIN` (a bare
`*.cloudflareaccess.com` hostname) and `ACCESS_AUD` (ADR-0039); the deployment
script rejects missing, malformed, and all-zero values before adapting Astro's
generated Worker config into the ignored `dist/server/wrangler.production.json`,
which sets `ACCESS_MODE` to `cloudflare`.
Provision the purge credential as a remote Worker secret, never a Wrangler var:

```sh
pnpm run config:production
pnpm exec wrangler secret put CLOUDFLARE_CACHE_PURGE_TOKEN --config dist/server/wrangler.production.json
pnpm run deploy:production
```

`deploy:production` rebuilds the site, regenerates and validates the config,
checks the remote secret list by name without reading its value, applies D1
migrations through that config, and only then deploys. Wrangler authentication
is supplied through the operator or CI environment. Missing identifiers or
purge secret fail closed before remote mutation.

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
| Admin        | Browser canvas APIs                      | Resize and convert to static WebP before upload ([ADR-0036](docs/adr/0036-bound-media-normalization-and-storage.md)). Native; no package                                                                                  |
| Shared       | `src/i18n/`                              | Typed string dictionary, no dependency ([ADR-0027](docs/adr/0027-localize-ui-strings-with-a-typed-dictionary.md)). English is typed against Spanish, so a missing key is a compile error                                  |
| Shared       | `src/lib/ids.ts`                         | `crypto.randomUUID()` wrappers ([ADR-0026](docs/adr/0026-generate-identifiers-with-crypto-randomuuid.md)). Native in Worker, Node, and browser                                                                            |
| Shared       | `src/lib/timestamps.ts`                  | Canonical date format for text columns ([ADR-0029](docs/adr/0029-store-timestamps-in-sqlite-current-timestamp-format.md)). Deliberately not ISO                                                                           |
| Shared       | `src/lib/runtime.ts`                     | The only place application code touches `locals.runtime.env`                                                                                                                                                              |
| Publish-time | Shiki                                    | Code highlighting, run **when publishing**, result stored in the code node. Never at render time                                                                                                                          |
| Public       | `Intl.DateTimeFormat`                    | Bilingual dates with no dependency. Receives the locale from the URL, not from the browser                                                                                                                                |
| Public       | —                                        | **No package.** That is the point of [ADR-0019](docs/adr/0019-render-astro-first-with-react-islands-for-behavior.md)                                                                                                      |
| Tooling      | `@cloudflare/vitest-plugin`              | D1 integration tests inside workerd ([ADR-0025](docs/adr/0025-test-d1-through-the-workers-vitest-pool.md)). Dev dependency; never shipped                                                                                 |

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

## Interaction and accessibility

The interface targets WCAG 2.2 AA in both themes.
`tests/e2e/accessibility.spec.ts` runs axe with the `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa` and `wcag22aa` tags over the homes, an article, the
listings, the series index, a tag page, the 404 and the main admin screens, in
light and dark, and expects no violations. A violation is fixed in source, not
silenced by disabling a rule.

### Focus

A base `:focus-visible` rule draws a 2px `--ring` outline offset by 2px on every
focusable element. `--ring` is the teal of `--primary` in light (5.39:1 on white,
4.84:1 on muted) and the brighter teal in dark (8.14:1 on the background, 7.17:1
on card), so it clears the 3:1 of WCAG 1.4.11 on every surface it sits on.
Components that draw their own ring, such as Button and the admin fields, keep it
at full `ring-ring` and set `outline-none`; a ring at a fraction of `--ring` does
not clear 3:1. Never remove an outline without drawing a ring in its place.

### Hit areas

| Control                                       | Minimum |
| --------------------------------------------- | ------- |
| Header controls, header section links         | 40px    |
| Pagination links, previous, next and ellipsis | 40px    |
| Footer links and admin text actions           | 24px    |
| Inline links in running text                  | exempt  |

Grow a target inside space the row already has (`min-h-10`, `size-10`) rather
than by changing the layout around it.

### Admin forms

Admin forms use the shadcn field primitives backed by Base UI in
`src/components/ui/field.tsx`, `input.tsx`, `textarea.tsx` and `select.tsx`.
Compose controls with `Field`, `FieldGroup` and `FieldLabel`; use the primitive's
`data-invalid` state for invalid-field styling. Set `aria-invalid` on the
control and point `aria-describedby` at the matching shadcn `FieldError` id so
the error is announced with its field and focus can move to the first invalid
control. Keep labels explicitly associated with a unique control id, including
controls rendered in repeated rows. The primitives own shared focus, contrast,
disabled and reduced-motion styles.

- **Native submit.** Each form has an `onSubmit` that prevents navigation and
  runs its save; the primary action is its one `type="submit"` button and every
  other action is `type="button"`. Enter and `required` therefore work.
- **Stable status regions.** `FormStatus` keeps an always-rendered polite region
  for progress and success and inserts an alert only when something fails.
  Neither region changes role. Field errors stay beside their controls.
- **Pending actions.** `PendingButton` disables the running action, adds a
  spinner hidden from assistive technology and held still under reduced motion,
  and keeps its label.
- **Hydration gate.** The shared `useHydrated` hook in
  `src/components/admin/admin-hydration.ts` reports when React has committed.
  The shell keeps its content `inert` and disables interactive controls outside
  that region until then, so actions on server-rendered markup are not lost
  (ADR-0023).

The admin shell opens with a skip link to a `main` landmark that takes focus
without joining the tab order.

### Strings with values

A translated string that carries a value uses named placeholders filled by
`interpolate` from `src/i18n/utils.ts` (`'Subir «{title}»'`), never
concatenation, so each locale keeps its own word order
([ADR-0027](docs/adr/0027-localize-ui-strings-with-a-typed-dictionary.md)). An
accessible name that differs from the visible text still contains it, first
where the sentence allows (WCAG 2.5.3).

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
- Every animation carries its reduced-motion opt-out:
  `motion-reduce:transition-none` or `motion-reduce:animate-none`. Motion stays
  on for everyone else, and reduced motion gets no motion rather than an
  opacity-only stand-in.
- Hover effects sit inside `@media (hover: hover) and (pointer: fine)`.
- High-frequency controls — primary nav, body links — do not move. A colour
  transition of 150 ms or less is allowed.
- Press feedback is the `--scale-press` token (`0.96`), applied as
  `active:scale-press`. Never write the scale inline.

Where motion is used:

| Surface                | Motion                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| Mobile nav             | Drawer slide + overlay fade, shared timing                          |
| Dropdowns, tooltips    | Fade + `scale(0.95)` from the trigger's `transform-origin`          |
| Buttons                | Press to `--scale-press`; colour, border and ring changes at 150 ms |
| Theme toggle           | Icon crossfade only                                                 |
| Post card hover        | Subtle cover scale, desktop pointers only                           |
| Page navigation        | Native CSS View Transitions, public layout only                     |
| Article body, listings | **None.** Content does not animate in.                              |

Two exceptions, both recorded in the ADR-0022 amendment:

- **Theme swaps suppress transitions for one frame**, so the page snaps to the
  new palette instead of animating every colour across. That is a rendering fix,
  not a motion preference.
- **The admin has no view transitions.** `src/styles/page-transitions.css` holds
  the `@view-transition` rule and is imported by the public layout only; both
  documents must opt in, so the admin's reloads snap.

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
- **Editor autosave is conflict-safe.** One mutable draft per localization uses
  serialized, debounced compare-and-swap saves; see ADR-0032 and ADR-0035.
- **Shiki theming is a one-way door.** Trust-safe structured tokens are stored
  inside published `content_json`, so changing the theme requires republishing.
