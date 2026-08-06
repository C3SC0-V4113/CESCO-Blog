import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/sqlite-proxy';

import { sqlLiteral } from './sql.ts';
import * as schema from '../src/db/schema.ts';
import { deriveReadingTime, deriveToc } from '../src/lib/content/derive.ts';
import { parseContentDoc } from '../src/lib/content/schema.ts';
import { toDbTimestamp } from '../src/lib/timestamps.ts';

/**
 * Bootstrap content for the local database (ADR-0017).
 *
 * Public rendering cannot be built or verified against an empty database, and
 * the admin is deliberately deferred. This script is the stand-in publisher
 * until it exists.
 *
 * It computes `reading_time_minutes` and `toc_json` through the **shared**
 * derivation module rather than its own copy. The future admin imports the same
 * module; duplicating the logic guarantees the two publish paths eventually
 * produce inconsistent derived data (ADR-0012).
 *
 * Statements are built from `src/db/schema.ts` through Drizzle, so column names
 * and JSON serialization cannot drift from the application. Because
 * `wrangler d1 execute` has no parameter binding, the bound values are inlined
 * through `sqlLiteral`.
 *
 * Identifiers are **fixed constants** rather than freshly generated ones so the
 * script is idempotent: re-running it replaces its own rows through
 * `INSERT OR REPLACE` and touches nothing else in the local database. A seed
 * that duplicated its content on every run, or that cleared whole tables to
 * avoid doing so, would both be worse to live with.
 */

const AUTHOR_ID = '9c2f0a51-6d3e-4b52-9c0f-1a7e5d8b3c40';
const POST_ID = 'c1d4e7f0-3a29-4b6c-8d5e-2f7a9b0c1d34';

const ES = {
  localizationId: '4f8b1c2d-5e6a-4079-8b1c-2d3e4f5a6b7c',
  revisionId: '7a1b2c3d-4e5f-4081-9a2b-3c4d5e6f7a8b',
  headingId: 'b2c3d4e5-f6a7-4192-8b3c-4d5e6f7a8b9c',
  secondHeadingId: 'd4e5f6a7-b8c9-41a3-9d4e-5f6a7b8c9d0e',
} as const;

const EN = {
  localizationId: '5a9c2d3e-6f70-418a-9c2d-3e4f5a6b7c8d',
  revisionId: '8b2c3d4e-5f60-4192-8b3c-4d5e6f7a8b9c',
  headingId: 'c3d4e5f6-a7b8-42a4-9c4d-5e6f7a8b9c0d',
  secondHeadingId: 'e5f6a7b8-c9d0-42b4-8e5f-6a7b8c9d0e1f',
} as const;

const PUBLISHED_AT = toDbTimestamp(new Date('2026-08-04T12:00:00Z'));

const esContent = parseContentDoc({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { blockId: 'a1b2c3d4-e5f6-4071-8a1b-2c3d4e5f6a71' },
      content: [
        {
          type: 'text',
          text: 'Hay juegos que llenan cada minuto con música y diálogo, y hay juegos que confían en lo que no suena. La diferencia rara vez es técnica: es editorial.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { blockId: ES.headingId, level: 2 },
      content: [{ type: 'text', text: 'El silencio como herramienta' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'a1b2c3d4-e5f6-4071-8a1b-2c3d4e5f6a72' },
      content: [
        {
          type: 'text',
          text: 'Cuando un espacio se queda sin banda sonora, el jugador empieza a escuchar sus propios pasos. Esa atención desplazada es la que convierte un pasillo cualquiera en un lugar que se recuerda.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { blockId: ES.secondHeadingId, level: 2 },
      content: [{ type: 'text', text: 'Cuando el silencio falla' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'a1b2c3d4-e5f6-4071-8a1b-2c3d4e5f6a73' },
      content: [
        {
          type: 'text',
          text: 'El recurso se agota si no hay contraste. Un juego enteramente silencioso no produce tensión, produce indiferencia, y el jugador termina llenando el vacío con un podcast.',
        },
      ],
    },
  ],
});

const enContent = parseContentDoc({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { blockId: 'f1e2d3c4-b5a6-4071-8f1e-2d3c4b5a6f71' },
      content: [
        {
          type: 'text',
          text: 'Some games fill every minute with music and dialogue, and some trust what is left unheard. The difference is rarely technical: it is editorial.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { blockId: EN.headingId, level: 2 },
      content: [{ type: 'text', text: 'Silence as a tool' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'f1e2d3c4-b5a6-4071-8f1e-2d3c4b5a6f72' },
      content: [
        {
          type: 'text',
          text: 'When a space drops its soundtrack, players start hearing their own footsteps. That displaced attention is what turns an ordinary corridor into somewhere worth remembering.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { blockId: EN.secondHeadingId, level: 2 },
      content: [{ type: 'text', text: 'When silence fails' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'f1e2d3c4-b5a6-4071-8f1e-2d3c4b5a6f73' },
      content: [
        {
          type: 'text',
          text: 'The device wears out without contrast. An entirely silent game does not build tension, it builds indifference, and the player ends up filling the gap with a podcast.',
        },
      ],
    },
  ],
});

// The proxy driver is never invoked: `.toSQL()` renders the statement without
// executing it. It exists only so the query builder has a dialect to compile
// against.
const db = drizzle(async () => ({ rows: [] }));

const statements: string[] = [];

/** Compiles an insert through Drizzle, then inlines its bound parameters. */
function push(query: { toSQL: () => { sql: string; params: unknown[] } }): void {
  const { sql, params } = query.toSQL();
  let consumed = 0;

  // `replace` scans the original string, so a `?` inside a rendered literal is
  // never mistaken for another placeholder.
  const inlined = sql.replace(/\?/g, () => {
    if (consumed >= params.length) {
      throw new Error(`More placeholders than parameters in: ${sql}`);
    }
    return sqlLiteral(params[consumed++]);
  });

  if (consumed !== params.length) {
    throw new Error(`Unused parameters in: ${sql}`);
  }

  // Drizzle emits `insert into`; the seed needs the row replaced on re-runs.
  statements.push(`${inlined.replace(/^insert into/i, 'insert or replace into')};`);
}

push(
  db.insert(schema.authors).values({
    id: AUTHOR_ID,
    slug: 'cesco-valle',
    name: 'Cesco Valle',
    bio: 'Escribe sobre videojuegos con más atención al diseño que al calendario de lanzamientos.',
  })
);

push(
  db.insert(schema.posts).values({
    id: POST_ID,
    section: 'analysis',
    editorialState: 'active',
    authorId: AUTHOR_ID,
  })
);

for (const locale of [
  {
    ids: ES,
    locale: 'es' as const,
    slug: 'el-peso-del-silencio',
    title: 'El peso del silencio en los juegos de exploración',
    excerpt: 'Por qué quitar la música es una decisión editorial y no un ahorro de producción.',
    content: esContent,
  },
  {
    ids: EN,
    locale: 'en' as const,
    slug: 'the-weight-of-silence',
    title: 'The weight of silence in exploration games',
    excerpt: 'Why removing the music is an editorial decision rather than a production saving.',
    content: enContent,
  },
]) {
  push(
    db.insert(schema.postLocalizations).values({
      id: locale.ids.localizationId,
      postId: POST_ID,
      locale: locale.locale,
      slug: locale.slug,
      status: 'published',
      publishedRevisionId: locale.ids.revisionId,
      firstPublishedAt: PUBLISHED_AT,
      currentPublishedAt: PUBLISHED_AT,
    })
  );

  push(
    db.insert(schema.postRevisions).values({
      id: locale.ids.revisionId,
      postLocalizationId: locale.ids.localizationId,
      version: 1,
      title: locale.title,
      excerpt: locale.excerpt,
      contentJson: locale.content,
      // Derived here rather than at render time, through the module the admin
      // will share (ADR-0012, ADR-0017).
      readingTimeMinutes: deriveReadingTime(locale.content),
      tocJson: deriveToc(locale.content),
    })
  );
}

/**
 * The structured facts behind the analysis (ADR-0012).
 *
 * The platform is a reference rather than free text, so the same console cannot
 * arrive spelled three ways across posts.
 */
const PLATFORM_ID = '3f8a2b1c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

push(
  db.insert(schema.platforms).values({
    id: PLATFORM_ID,
    slug: 'pc',
    name: 'PC',
  })
);

push(
  db.insert(schema.postAnalysisMetadata).values({
    postId: POST_ID,
    playedPlatformId: PLATFORM_ID,
    playtimeHours: 24,
    completionState: 'completed',
    // Set so the local site actually renders the disclosure. ADR-0012 requires
    // it to be visible on the page rather than merely stored, and a seed where
    // it never fires cannot show whether that holds.
    receivedReviewCopy: true,
    reviewCopyProvider: 'Estudio Ejemplo',
  })
);

/**
 * Two states the URL lifecycle has to answer for, which a set of happily
 * published posts can never exercise (ADR-0010).
 *
 * Without them the local site can only ever show a `200` and a `404`, and the
 * `410` and `301` paths — the two the ADR was actually written for — would have
 * no way to be seen or tested outside a unit test.
 */

// The Spanish article was published under an earlier name. Its current slug is
// unchanged; only the retired one is recorded, so the old address redirects.
push(
  db.insert(schema.postLocalizationSlugHistory).values({
    id: '2c7d9e0f-1a3b-45c6-8d7e-9f0a1b2c3d4e',
    postLocalizationId: ES.localizationId,
    locale: 'es',
    oldSlug: 'el-silencio-en-los-videojuegos',
    retiredAt: PUBLISHED_AT,
  })
);

// A post published and then withdrawn. `status` returns to draft and the
// published revision is cleared, but `first_published_at` survives — that is
// the single field that makes this URL answer 410 instead of 404.
const WITHDRAWN = {
  postId: 'd2e5f8a1-4b3c-4d7e-9f0a-3b6c9d2e5f81',
  localizationId: '6b0d3e4f-7a81-49b2-8d3e-4f5a6b7c8d9e',
  revisionId: '9c3d4e5f-6a71-42b3-9c4d-5e6f7a8b9c0d',
} as const;

const withdrawnContent = parseContentDoc({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { blockId: 'b1c2d3e4-f5a6-4081-9b1c-2d3e4f5a6b81' },
      content: [
        {
          type: 'text',
          text: 'Este texto se publicó y más tarde se retiró. Existe en la base de datos para que la dirección pueda responder que el contenido se fue, en vez de fingir que nunca estuvo.',
        },
      ],
    },
  ],
});

push(
  db.insert(schema.posts).values({
    id: WITHDRAWN.postId,
    section: 'opinion',
    editorialState: 'active',
    authorId: AUTHOR_ID,
  })
);

push(
  db.insert(schema.postLocalizations).values({
    id: WITHDRAWN.localizationId,
    postId: WITHDRAWN.postId,
    locale: 'es',
    slug: 'una-opinion-retirada',
    status: 'draft',
    publishedRevisionId: null,
    firstPublishedAt: PUBLISHED_AT,
    currentPublishedAt: PUBLISHED_AT,
  })
);

push(
  db.insert(schema.postRevisions).values({
    id: WITHDRAWN.revisionId,
    postLocalizationId: WITHDRAWN.localizationId,
    version: 1,
    title: 'Una opinión retirada',
    contentJson: withdrawnContent,
    readingTimeMinutes: deriveReadingTime(withdrawnContent),
    tocJson: deriveToc(withdrawnContent),
  })
);

/**
 * A published series with the analysis in it.
 *
 * Seeded so the local site can show the surface at all, and so the end-to-end
 * suite has a real collection URL to exercise the ADR-0010 lifecycle against.
 */
const COLLECTION_ID = '7e1a4b2c-9d3f-4058-8a1b-6c7d8e9f0a1b';

push(
  db.insert(schema.collections).values({
    id: COLLECTION_ID,
    editorialState: 'active',
  })
);

push(
  db.insert(schema.collectionLocalizations).values({
    id: '8f2b5c3d-0e4a-4169-9b2c-7d8e9f0a1b2c',
    collectionId: COLLECTION_ID,
    locale: 'es',
    slug: 'el-sonido-en-los-juegos',
    title: 'El sonido en los juegos',
    description: 'Una serie sobre cómo suenan —y cómo callan— los mundos que jugamos.',
    status: 'published',
    firstPublishedAt: PUBLISHED_AT,
  })
);

push(
  db.insert(schema.collectionPosts).values({
    collectionId: COLLECTION_ID,
    postId: POST_ID,
    position: 0,
  })
);

const outputPath = path.join(process.cwd(), '.wrangler', 'seed.sql');

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `-- Generated by scripts/seed.ts (ADR-0017). Do not edit by hand.\n${statements.join('\n')}\n`,
  'utf8'
);

console.log(`Wrote ${statements.length} statements to ${path.relative(process.cwd(), outputPath)}`);
