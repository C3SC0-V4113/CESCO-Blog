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
| Route composition          | `src/pages/`                |
| Theme token                | `src/styles/global.css`     |

Dependencies flow one way: **feature → common → ui**. Never edit a primitive to
add product behavior — wrap it from `common/`, because the next registry update
reverts local edits.

### Registries

Governed by
[ADR-0020](docs/adr/0020-extend-shadcn-with-base-ui-compatible-registries.md).
This project uses **Base UI**, not Radix.

| Registry                         | Status                            |
| -------------------------------- | --------------------------------- |
| `@shadcn`                        | Configured                        |
| [Coss UI](https://coss.com/ui)   | To add — built on Base UI         |
| [ReUI](https://reui.io)          | To add — **Base UI variant only** |
| [chanhdai](https://chanhdai.com) | Rejected pending audit            |

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

## Surfaces

Routes from
[ADR-0004](docs/adr/0004-use-cloudflare-cache-for-isr-like-publishing.md).

| Surface        | Route                                | Key components                                                                                                                                                       |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial home | `/es`, `/en`                         | `PostCard` (featured + recent), `SectionHeading`, `EmptyState`                                                                                                       |
| Full listing   | `/es/blog`, `/en/blog`               | `PostCard`, `Pagination`                                                                                                                                             |
| Section        | `/es/analisis`, `/es/opiniones` + EN | `PostCard`, `Pagination`, `SectionHeading`                                                                                                                           |
| Article detail | `/es/analisis/[slug]` + EN           | `Prose`, `ArticleBody`, `Byline`, `TableOfContents`, `TocScrollSpy`, `DisclosureNotice`, `AnalysisMetaPanel`, `SeriesNav`, `TagPill`, `CopyLinkButton`, `Breadcrumb` |
| Game page      | `/es/juegos/[slug]` + EN             | `GameFactsPanel`, `PostCard`, `Badge`                                                                                                                                |
| Tag page       | `/es/etiquetas/[slug]` + EN          | `PostCard`, `Pagination`, `TagPill`                                                                                                                                  |
| Series         | `/es/series/[slug]` + EN             | `CollectionHeader`, ordered `PostCard` list                                                                                                                          |
| Trust pages    | 5 routes × 2 locales                 | `Prose` only                                                                                                                                                         |
| `404`          | any locale                           | `ErrorState` — "this never existed"                                                                                                                                  |
| `410`          | any locale                           | `ErrorState` — "this was removed"                                                                                                                                    |

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
| `TocScrollSpy`             | `post/`       | **island** | `IntersectionObserver` over headings — `client:visible`                            |
| `CopyLinkButton`           | `post/`       | **island** | `navigator.clipboard` — `client:visible`                                           |
| `ThemeToggle`              | `nav/`        | **island** | `localStorage` — `client:load`                                                     |
| `MobileNav`                | `nav/`        | **island** | Focus trap, keyboard dismissal — `client:idle`                                     |
| `LocaleSwitcher`           | `nav/`        | **island** | `client:idle`; stays `.astro` if it is only a link                                 |

Five islands. Everything else ships no JavaScript.

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

LCP on the article page is the cover image. It needs explicit dimensions from
`media_assets.width`/`height` to avoid layout shift. A concrete LCP target is
still to be set.

---

## Debt and open questions

- **`home-hero.tsx` is misplaced.** It is a product component at the root of
  `src/components/`, and `tests/unit/home.test.tsx` imports it from there. It
  moves to `common/` or is replaced by the real home page, and the test follows.
- **`chanhdai` registry is unaudited.** Its TOC Minimap and Theme Toggle Effect
  are genuinely useful. Adopting either requires confirming the entry declares no
  `motion`/`framer-motion` dependency and ships no Radix primitive.
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
