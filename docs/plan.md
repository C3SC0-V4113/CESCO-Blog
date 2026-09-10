# Plan de implementación: los ADRs en PRs encadenados

> **Nota de vigencia — 2026-08-12.**
>
> Este documento se escribió **antes** de implementar nada, y se corrigió el
> 2026-08-05 tras verificar sus afirmaciones contra el repositorio. La cadena A
> (sitio público) ya está construida y mergeada; la cadena B (admin) todavía no.
>
> Se conserva como registro de las decisiones de planificación, no como
> descripción del estado actual. Varias de sus premisas se cayeron al construir:
>
> - **El techo de tamaño pasó de 400 a 800 líneas.** Está anotado en C13, con la
>   evidencia que lo motivó.
> - **El `og-generator` no necesita Satori para las portadas.** ADR-0015 define la
>   imagen editorial como "sin texto", y sin texto no hace falta fuente ni Satori
>   ni builds `.ttf` estáticos. Las portadas se generan con SVG y un rasterizador.
>   Satori sigue haciendo falta para la card social, que sí lleva texto quemado.
> - **La cadena A necesitó más PRs de los previstos** — identidad, navegación,
>   seed, diseño editorial, entrega de media, portadas, series. Por eso **la
>   numeración de este plan no coincide con la de GitHub**: el PR 13 del plan no
>   es el PR 13 del repositorio. Referirse a los ítems por nombre.
> - **Dos decisiones que el plan dejó abiertas ya se tomaron**: la frontera
>   draft/revisión está en [ADR-0032](adr/0032-separate-drafts-from-revisions.md),
>   y el bloqueo de slug de colección se hace cumplir en el PR 18 (C7).
> - **Aparecieron dos ADRs nuevos** durante la construcción:
>   [ADR-0033](adr/0033-serve-media-from-r2-through-the-worker.md), la entrega de
>   media desde R2, que era prerequisito no contemplado del generador de OG.
>
> Ante una discrepancia entre este plan y el estado del repositorio, gana el
> repositorio. Los ADRs son la fuente de verdad de las decisiones.

---

## Contexto

El plan original es sólido y sus tres decisiones (stacked a `main`, alcance
público + admin, spike vertical del artículo primero) se sostienen. Verifiqué sus
afirmaciones contra el repo y la mayoría son correctas. Este documento
**reemplaza** al original incorporando las correcciones encontradas.

### Lo que verifiqué y estaba bien

| Afirmación del plan                                                              | Estado                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 29 ADRs                                                                          | ✅ `docs/adr/0001..0029`, sin huecos                              |
| Migraciones 0000–0009                                                            | ✅ 10 archivos en `drizzle/`, registrados en `meta/_journal.json` |
| "D1 permite 50 queries por invocación (ADR-0016)"                                | ✅ `docs/adr/0016-*.md:69,81` — la cita es correcta               |
| Anchors del TOC desde `blockId`, no del texto (ADR-0012)                         | ✅ `docs/adr/0012-*.md:50-52`                                     |
| Copy de 404/410 ya en `src/i18n/ui.ts`                                           | ✅ claves `error.404.*` / `error.410.*`                           |
| `i18n/`, `lib/ids`, `lib/timestamps` solo consumidos por tests, `check` en verde | ✅ únicos consumidores: `tests/` + `src/i18n/utils.ts` interno    |
| Nada entra a `ui/` que no venga de registry (ADR-0021)                           | ✅ `docs/adr/0021-*.md:47`                                        |
| `home-hero.tsx` es el único componente React con test unitario                   | ✅                                                                |
| `check` = lint → typecheck → format → tests → react-doctor                       | ✅                                                                |

Matiz sobre migraciones: los 10 archivos existen y están en el journal, pero eso
no prueba que hayan corrido contra la D1 local. Es estado de runtime.

---

## Correcciones aplicadas

### C1 — Orden roto: PR 8 depende del PR 9

`docs/adr/0014-*.md:63` — _"Both endpoints must be cached per ADR-0011."_ El
sitemap es la query más pesada del sitio y sin caché es el punto de caída más
probable. `distribution` no puede ir antes de `cache-tags`.

**→ Se intercambian: `cache-tags` pasa a ser PR 8, `distribution` PR 9.**

### C2 — IndexNow no es código

`docs/adr/0014-*.md:72` — es un _zone-level toggle_ de Cloudflare Crawler Hints.
No lo entrega ningún PR.

**→ Sale del entregable de distribución, va a la sección de acciones manuales.**

### C3 — Dependencias que no existen

Ninguna de estas está instalada: `zod`, `@astrojs/rss`, `@tiptap/*`,
`react-hook-form`, `satori`, `@resvg/resvg-js`. El plan original nunca menciona
instalarlas. `class-variance-authority`, `@base-ui/react` y `@vitejs/plugin-react`
sí están.

**→ Cada PR declara la dependencia que introduce. Ver columna nueva en las tablas.**

### C4 — Zod no lo respalda ningún ADR

Es una decisión de arquitectura nueva del PR 1. Ningún ADR la nombra. Peor:
`docs/adr/0017-*.md:55` acepta explícitamente que el seed _"bypasses any
validation the admin would eventually [enforce]"_ — el PR 1 mejora eso, pero
mejorar una consecuencia aceptada en un ADR es cambiar la decisión.

**→ El PR 1 escribe `docs/adr/0030-validate-content-json-with-zod.md` y agrega la
nota de superación en ADR-0017, igual que ADR-0004 la tiene apuntando a ADR-0011.**

### C5 — Nav progresivo (decisión confirmada)

`src/i18n/ui.ts` ya define `nav.blog`, `nav.analysis`, `nav.opinion`, `nav.series`,
`nav.search`. Un `SiteHeader` que las renderice en el PR 4 linkea a rutas
inexistentes; `nav.search` no existe en ningún PR de esta cadena.

**→ `SiteHeader` recibe un array `navItems` que arranca solo con las rutas vivas.
Cada PR que crea una ruta agrega su entrada. `nav.search` queda sin usar hasta que
la búsqueda se especifique — se documenta, no se borra la clave.**

### C6 — Falta la ruta de `opinion`

`docs/adr/0007-*.md` define **dos** secciones: analysis y opinion. El PR 2 solo
crea `/es/analisis/[slug]` y `/en/analysis/[slug]`.

**→ El PR 2 crea las cuatro rutas de detalle. El renderer es el mismo; el costo es
el parámetro de sección, no un segundo componente.**

### C7 — Colecciones sin historial de slug

`docs/adr/0010-*.md:74-81` es explícito en dos puntos que el plan ignora:

1. _"series URL behaves like a withdrawn article URL"_ → el resolver del PR 3
   tiene que cubrir colecciones, no solo posts.
2. _"Collections do not yet maintain slug history… a mutable slug with no history
   is the one combination that silently breaks links."_

El ADR marca esto como el agujero conocido y el plan lo saltea en el PR 10 y en
el PR 18.

**→ El PR 10 lo hereda como restricción explícita: mientras no exista
`collection_localization_slug_history`, el admin del PR 18 **no permite editar el
slug de una colección publicada**. Se documenta en el PR 10 y se hace cumplir en
el PR 18. Crear la tabla es una migración fuera de esta cadena.**

### C8 — ADRs mal atribuidos

| PR                | Cita original | Correcta             | Por qué                                                                                          |
| ----------------- | ------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| listings          | 0014          | **0016**, 0007       | 0014 es RSS/sitemap. El límite de 50 queries —que es justo lo que verifica su fila— está en 0016 |
| cache-tags        | 0011          | 0011, **0004**       | 0004 es la decisión original, concretada por 0011                                                |
| taxonomy-surfaces | 0004          | **0012**, 0010       | 0004 es caché, no taxonomía                                                                      |
| design-system     | 0027          | 0021, 0022, **0020** | 0020 define de qué registries salen los componentes                                              |
| url-lifecycle     | 0010          | 0010, **0009**       | el caso "archivado global" es ADR-0009                                                           |
| og-generator      | 0015          | 0015, **0006**       | 0006 modela media y social preview                                                               |

### C9 — "View Transitions" es ambiguo y peligroso

`docs/adr/0022-*.md:69-72` es taxativo: **native CSS `@view-transition
{ navigation: auto; }`, NO `<ClientRouter />`**, porque este último introduce
runtime cliente. Escrito "View Transitions" a secas, la implementación va derecho
al `ClientRouter` y rompe el "cero JS" que el PR 2 acaba de conseguir.

**→ Se nombra explícitamente en el entregable del PR 4.**

### C10 — El "cero JS" no tiene guard permanente

Se verifica a mano en el PR 2 y después se puede romper en silencio.

**→ El PR 2 deja un test e2e que asserta cero requests de script en la página de
artículo. Sobrevive toda la cadena A.**

### C11 — `check` no corre e2e

`check` = lint → typecheck → format → `vitest run` → doctor. **No incluye
Playwright.** El plan original apoya su gate de cierre en `check`, así que un e2e
roto pasa el gate.

**→ El gate de cierre pasa a ser `pnpm run check && pnpm run test:e2e`. Esto
importa desde el PR 2, que es donde nace el guard de C10.**

### C12 — `doctor.config.json` tiene que achicarse, no crecer

Hoy exime `src/db/schema.ts`, `src/db/client.ts` y `src/lib/utils.ts` de
`knip/exports` — existen porque nadie los consume todavía.

**→ Cuando el PR 2 le dé consumidores reales a `db/`, ese override se recorta en
el mismo PR. Agregar un override nuevo requiere justificación escrita en el PR.**

### C13 — Seis PRs a ~400 líneas, cero margen

400 es el techo del skill `chained-pr`, no el objetivo.

**→ Presupuesto de trabajo: ~320 líneas. 400 es el límite duro que dispara split.**

> **Revisado el 2026-08-05, tras los PRs 1, 2 y 3.** Los tres cerraron cerca de
> las 800 líneas y las tres veces el corte natural del trabajo era uno solo:
> partirlos habría dejado estados intermedios rotos. Alrededor del 35% de cada
> PR son tests, más una densidad deliberada de comentarios que explican el
> porqué — ambas decisiones del proyecto, no accidentes, y el 400 del skill no
> las contempla.
>
> **El techo pasa a 800.** Por encima de eso sí se pide excepción firmada.
> Las estimaciones de las tablas de abajo quedan como estaban: se escribieron
> antes de medir nada y subirlas ahora sería reescribir el pronóstico para que
> coincida con el resultado.

### C14 — La tabla de verificación no cubre los PRs 5, 9, 10, 11 y 12

**→ Se completa abajo.**

### C15 — Acción manual no listada: Email Routing

`docs/adr/0018-*.md:56` — la página de contacto depende de recibir mail vía
Cloudflare. Setup de dashboard, igual que la migración de nameservers.

**→ Va a acciones manuales.**

---

## La restricción que ordena todo

Verificado: `src/i18n/`, `src/lib/ids.ts` y `src/lib/timestamps.ts` hoy solo los
consumen tests, y `check` pasa en verde. La regla del plan original se sostiene:

> Todo export nace con su test en el mismo PR. Un test cuenta como consumidor.

Con una salvedad que el original no dice: un archivo **sin** test y **sin**
consumidor necesita override en `doctor.config.json` — es exactamente por qué
`src/lib/utils.ts` está exento hoy. El override es la excepción justificada, no
la salida por defecto (ver C12).

### Borrado de `home-hero.tsx`

Se elimina —junto a `tests/unit/home.test.tsx`— **en el PR 2**, donde nacen
`ArticleBody` y `Prose`. Borrarlo antes deja el project `unit` sin tests y a
`@vitejs/plugin-react` sin uso.

`tests/e2e/home.spec.ts` se **reemplaza** en el PR 2 por el guard de cero JS (C10),
no en el PR 6. Adelantarlo es lo que le da al guard toda la cadena de vigencia.

---

## Cadena A — Sitio público

| #   | PR                    | Entrega                                                                                                                           | ADRs                             | Dep. nueva                  | Tamaño |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------- | ------ |
| 1   | `content-contract`    | Esquema Zod de `content_json`, derivación de reading time y TOC, seed script, **ADR-0030**                                        | 0002, 0012, 0017, 0024, **0030** | `zod`                       | ~300   |
| 2   | `article-detail`      | Query de post publicado, `ArticleBody`, `Prose`, **4 rutas de detalle**. Borra home-hero, **guard e2e de cero JS**                | 0019, 0012, **0007**             | —                           | ~380   |
| 3   | `url-lifecycle`       | Resolución 404/410/301, historial de slugs, páginas de error                                                                      | 0010, **0009**                   | —                           | ~320   |
| 4   | `design-system`       | Tokens, tipografía, escala de easing, **`@view-transition` nativo (no ClientRouter)**, `SiteHeader` con **`navItems` progresivo** | 0021, 0022, **0020**             | —                           | ~380   |
| 5   | `article-metadata`    | `Byline`, `ReadingTime`, `TableOfContents` + scroll-spy, `DisclosureNotice`, `AnalysisMetaPanel`                                  | 0012, 0013                       | —                           | ~380   |
| 6   | `listings`            | `PostCard`, portada, `/blog`, secciones, paginación. **+3 `navItems`**                                                            | 0019, **0016**, **0007**         | —                           | ~400   |
| 7   | `seo-head`            | Canonical, `hreflang`, `x-default`, Open Graph, JSON-LD                                                                           | 0013                             | —                           | ~300   |
| 8   | `cache-tags`          | `Cache-Tag` en respuestas, módulo de purga, invalidación cruzada de locale                                                        | 0011, **0004**                   | —                           | ~280   |
| 9   | `distribution`        | `/sitemap.xml`, RSS por idioma, `robots.txt`. **Sin IndexNow**                                                                    | 0014, 0011                       | `@astrojs/rss`              | ~300   |
| 10  | `taxonomy-surfaces`   | Páginas de tag, juego y serie. **+`navItems` series.** Documenta el bloqueo de slug de colección                                  | **0012**, 0010                   | —                           | ~380   |
| 11  | `trust-and-analytics` | 5 páginas de confianza × 2 idiomas, Cloudflare Web Analytics                                                                      | 0018                             | —                           | ~300   |
| 12  | `og-generator`        | Script local Satori + resvg, subida a R2, escritura de `og_image_media_id`                                                        | 0015, **0006**                   | `satori`, `@resvg/resvg-js` | ~350   |

## Cadena B — Admin

| #   | PR               | Entrega                                                                                      | ADRs                 | Dep. nueva        | Tamaño |
| --- | ---------------- | -------------------------------------------------------------------------------------------- | -------------------- | ----------------- | ------ |
| 13  | `admin-shell`    | Layout de admin, isla `client:load`, dashboard, límite de Access                             | 0003, 0023           | —                 | ~300   |
| 14  | `admin-posts`    | Listado, creación, formularios de metadata con Zod + react-hook-form                         | 0023, 0012           | `react-hook-form` | ~400   |
| 15  | `editor-core`    | Tiptap headless, toolbar, IDs estables y autosave CAS en `post_drafts`                       | 0024, 0032, 0035     | `@tiptap/*`       | ~400   |
| 16  | `media-uploads`  | Normalización en cliente, endpoint R2, `media_assets`, sync de `post_revision_media`         | 0024, 0028, **0006** | —                 | ~400   |
| 17  | `publish-flow`   | Publicar, despublicar, cambio de slug con historial, purga de caché                          | 0010, 0011           | —                 | ~350   |
| 18  | `admin-taxonomy` | Colecciones, autores, destacados, SEO/OG con preview de card social. **Slug bloqueado (C7)** | 0012, 0015, **0010** | —                 | ~400   |

Los tamaños de la cadena B son estimaciones flojas. **Se replanifica al cerrar el
PR 12**, cuando ya haya render real contra el que medir.

---

## Reglas que aplican a todos los PRs

**TDD estricto.** Test que falla primero. Datos → project `integration` (workerd +
D1 real); componentes y utilidades puras → project `unit`.

**Nada entra a `ui/` que no venga de un registry** (ADR-0021:47). Producto va a
`common/` o a su carpeta de feature. Las carpetas se crean con su primer componente.

**Cortar por `cva`, no por React.** Donde una primitiva solo aporta estilo, se
importa su función de variantes desde el `.astro` (ADR-0019).

**Ningún componente hardcodea color ni radio.** Todo sale de los tokens.

**Toda cadena visible pasa por `useTranslations`.** Español neutro, sin voseo,
impersonal (ADR-0027).

**Fechas por `formatDate`, escrituras por `toDbTimestamp`.** Nunca `toISOString()`
en columna de texto (ADR-0029).

**Motion CSS-only.** `@view-transition` nativo. `<ClientRouter />` está prohibido
por ADR-0022:70.

**Presupuesto ~320 líneas, techo duro 400** (C13 — revisado a 800).

**Cierre de cada PR:**

```bash
pnpm run check && pnpm run test:e2e
```

Los dos en 0. `check` cubre lint, typecheck, formato, los dos projects de vitest y
react-doctor; **no cubre Playwright**, de ahí el segundo comando (C11). Recién ahí
va el commit convencional.

---

## Verificación

Por PR, además del gate de cierre:

```bash
pnpm run db:migrate:local && pnpm run db:seed
```

```bash
pnpm run dev:cf
```

| PR  | Qué mirar                                                                              |
| --- | -------------------------------------------------------------------------------------- |
| 1   | El seed inserta y `reading_time_minutes` / `toc_json` quedan poblados                  |
| 2   | `/es/analisis/<slug>` y `/es/opinion/<slug>` renderizan; **cero JS en el network tab** |
| 3   | Un slug retirado da `410`; uno renombrado dos veces, `301` en **un** salto             |
| 4   | Títulos en Merriweather, cuerpo en Figtree; el toggle no produce flash                 |
| 5   | El scroll-spy sigue anclas de `blockId`; reescribir un heading no rompe el deep link   |
| 6   | Un listado hace **una** query — verificable en los logs de D1                          |
| 7   | El `hreflang` no declara el idioma en draft (ADR-0013:65)                              |
| 8   | Publicar una localización purga **ambos** idiomas vía `post-{postId}` (ADR-0011:48)    |
| 9   | El `guid` del RSS no cambia al renombrar el slug; el sitemap sale cacheado             |
| 10  | Una serie retirada devuelve `410`, no `404`                                            |
| 11  | Analytics no setea cookies; las 5 páginas existen en ambos idiomas                     |
| 12  | El OG generado sube a R2 y `og_image_media_id` queda escrito                           |

Al cerrar la cadena A, antes de la B: Lighthouse contra la página de artículo,
**fijar el número de LCP** que `DESIGN.md:571` dejó explícitamente pendiente, y el
benchmark `.astro` vs `.tsx` de ADR-0019. Ambos necesitaban páginas reales.

---

## Fuera de alcance

**Búsqueda** (`/es/buscar`): sin especificar, depende de decisiones de indexado no
tomadas. La clave `nav.search` ya existe en `ui.ts` y **queda deliberadamente sin
consumidor** — se documenta en el PR 4, no se borra.

**Frontera draft/revisión:** resuelta antes del PR 15.

> **Resuelto el 2026-08-07** en
> [ADR-0032](adr/0032-separate-drafts-from-revisions.md): una revisión es un
> snapshot **publicado**; el borrador vive en una tabla `post_drafts` mutable, una
> fila por localización. La migración llega con el PR 15.

**`collection_localization_slug_history`**: la tabla que cerraría el agujero de
ADR-0010:79 es una migración fuera de esta cadena. Hasta entonces rige el bloqueo
del PR 18 (C7).

### Acciones manuales tuyas, no las ejecuta ningún PR

| Qué                                                 | Origen            |
| --------------------------------------------------- | ----------------- |
| Migración de nameservers                            | ADR-0016          |
| Toggle de IndexNow / Crawler Hints en el dashboard  | ADR-0014:72 (C2)  |
| Cloudflare Email Routing para la página de contacto | ADR-0018:56 (C15) |
| Habilitar Cloudflare Web Analytics                  | ADR-0018          |
