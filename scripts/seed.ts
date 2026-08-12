import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import { sqlLiteral } from './sql.ts';
import * as schema from '../src/db/schema.ts';
import { deriveReadingTime, deriveToc } from '../src/lib/content/derive.ts';
import { parseContentDoc } from '../src/lib/content/schema.ts';
import { coverSvg, COVER_HEIGHT, COVER_WIDTH } from '../src/lib/cover.ts';
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

/** A tag and a game, so both surfaces have something to show locally. */
const TAG_ID = '1a2b3c4d-5e6f-4071-8a9b-0c1d2e3f4a5b';
const GAME_ID = '2b3c4d5e-6f70-4182-9b0c-1d2e3f4a5b6c';

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

/**
 * Generated editorial covers.
 *
 * Every post gets one, so the listings and the article page have an image
 * without waiting for an upload pipeline that does not exist yet (ADR-0015
 * requires a cover at publish; nothing can supply one until the admin does).
 *
 * The identifier is derived from the post id rather than generated, so
 * re-running the seed replaces the same rows and overwrites the same objects.
 * Same reason every other id here is a constant.
 */
/** Every object the seed puts in R2 — covers and the example asset alike. */
const uploads: { key: string; file: string }[] = [];

function pushCover(postId: string, slug: string, section: 'analysis' | 'opinion'): string {
  // A stable identifier per post: the cover of a post is a fact about that
  // post, so regenerating must not orphan the previous object in R2.
  const mediaId = `c0${postId.slice(2)}`;
  const key = `media/2026/08/${mediaId}.png`;
  const file = path.join(process.cwd(), '.wrangler', `cover-${mediaId}.png`);

  const png = new Resvg(coverSvg(slug, section)).render().asPng();

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, png);
  uploads.push({ key, file });

  push(
    db.insert(schema.mediaAssets).values({
      id: mediaId,
      r2Key: key,
      // Decorative rather than informative: it carries no content a reader
      // would miss, so the alt text says what it is instead of describing
      // shapes nobody needs described.
      altText: null,
      isOwnWork: true,
      contentType: 'image/png',
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      sizeBytes: png.byteLength,
    })
  );

  return mediaId;
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
  db.insert(schema.games).values({
    id: GAME_ID,
    slug: 'un-juego-de-ejemplo',
    title: 'Un juego de ejemplo',
    developer: 'Estudio Ejemplo',
    publisher: 'Distribuidora Ejemplo',
    releaseDate: '2025-11-14',
  })
);

push(db.insert(schema.tags).values({ id: TAG_ID, slug: 'diseno-sonoro', name: 'Diseño sonoro' }));

push(
  db.insert(schema.posts).values({
    id: POST_ID,
    section: 'analysis',
    editorialState: 'active',
    authorId: AUTHOR_ID,
    gameId: GAME_ID,
    coverMediaId: pushCover(POST_ID, 'el-peso-del-silencio', 'analysis'),
  })
);

// After the post: the join row needs both sides to exist.
push(db.insert(schema.postTags).values({ postId: POST_ID, tagId: TAG_ID }));

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
 * Filler posts, so the listings have depth and the article page has something
 * to exercise.
 *
 * They started as twelve identical stubs whose only job was to push a second
 * page into existence. That worked and taught nothing: none had an author, none
 * had a heading, so no filler article could show a byline or a table of
 * contents, and the outline could not be judged on a real page.
 *
 * Now they vary the way real posts vary. Most carry an author and three or four
 * headings; two deliberately carry neither, because the floor of what can be
 * published is also a case worth seeing rendered — a post with no outline
 * should not look broken.
 *
 * Two choices are load-bearing for the suite rather than editorial:
 *
 * - **Spanish only.** The English listings stay a single page, so "keeps each
 *   locale to its own listing" still reads what it meant to read, and the empty
 *   state has somewhere to render.
 * - **Older than `PUBLISHED_AT`.** Listings order by `first_published_at`
 *   descending, so these sort underneath and every assertion that expects a
 *   named post still finds it on page one.
 */
const SECOND_AUTHOR_ID = 'b7e4c210-8a1d-4f36-9e52-3c8b1d0a4f77';

push(
  db.insert(schema.authors).values({
    id: SECOND_AUTHOR_ID,
    slug: 'marta-riera',
    name: 'Marta Riera',
    bio: 'Escribe sobre diseño de niveles y sobre por qué un pasillo puede ser una decisión.',
  })
);

/**
 * Body copy for the filler posts.
 *
 * Nine sentences rotated across every heading of every post, so no two sections
 * read alike. They argue about game design rather than saying nothing, because
 * a seed that says nothing cannot show whether the typography carries an
 * argument — which is the only job a reading page has.
 */
const PARAGRAPHS = [
  'Un juego rara vez explica sus decisiones, pero las toma en todo momento. Mirarlas de cerca es la única forma de distinguir lo que se eligió de lo que simplemente quedó así.',
  'Hay una diferencia entre exigir atención y merecerla. La primera se consigue con obstáculos; la segunda, con algo que valga la pena mirar dos veces.',
  'El diseño se nota cuando falla. Mientras funciona parece que no estuviera, y esa invisibilidad es el resultado de mucho trabajo deliberado.',
  'Ningún sistema es neutral. Cada regla decide qué tipo de jugador va a prosperar, y esa decisión se toma mucho antes de que alguien encienda la consola.',
  'La repetición no es aburrimiento por sí sola. Se vuelve aburrimiento cuando repetir deja de enseñar algo nuevo sobre el sistema que se repite.',
  'Lo difícil no es agregar una mecánica, es sostenerla veinte horas sin que se agote. Casi todo lo que sobra en un juego estuvo ahí desde la primera hora.',
  'Un espacio bien construido se recuerda sin mapa. Si hace falta consultarlo cada vez, el problema rara vez está en el mapa.',
  'El ritmo importa más que la cantidad. Dos horas bien administradas dejan más que veinte que no saben cuándo dejar al jugador en silencio.',
  'Toda interfaz argumenta algo sobre lo que el juego considera importante. Lo que se pone en pantalla, y sobre todo lo que se decide no poner, es una postura.',
];

/**
 * Each entry becomes one published Spanish post.
 *
 * `headings` drives everything derived: the outline, the reading time, and
 * whether the table of contents renders at all. The empty arrays are the point
 * of the two entries that have one.
 */
const fillers: {
  title: string;
  section: 'analysis' | 'opinion';
  author: string | null;
  excerpt: string;
  headings: string[];
}[] = [
  {
    title: 'El mapa que no querías abrir',
    excerpt: 'Abrir el mapa es admitir que el espacio no se explicó solo.',
    section: 'analysis',
    author: AUTHOR_ID,
    headings: [
      'La fricción como diseño',
      'Cuando el mapa miente',
      'Lo que se pierde al simplificar',
    ],
  },
  {
    title: 'Guardar la partida es una decisión de diseño',
    excerpt: 'Dónde se puede guardar dice qué clase de error el juego considera aceptable.',
    section: 'analysis',
    author: SECOND_AUTHOR_ID,
    headings: [
      'El punto de guardado como castigo',
      'Autoguardado y ansiedad',
      'Confiar en el jugador',
      'Dos escuelas que no se hablan',
    ],
  },
  {
    title: 'Tutoriales que no parecen tutoriales',
    excerpt: 'Los mejores tutoriales terminan antes de que el jugador note que empezaron.',
    section: 'analysis',
    author: AUTHOR_ID,
    headings: [
      'Enseñar sin decirlo',
      'El primer cuarto como examen',
      'Cuando el juego se explica de más',
    ],
  },
  {
    title: 'La cámara también narra',
    excerpt: 'Elegir qué se ve es elegir qué se siente. La cámara nunca es neutral.',
    section: 'analysis',
    author: SECOND_AUTHOR_ID,
    headings: [
      'Encuadre y tensión',
      'La cámara libre y su costo',
      'Planos fijos en un medio interactivo',
    ],
  },
  {
    title: 'Notas sueltas sobre un juego corto',
    section: 'analysis',
    author: null,
    excerpt: 'Apuntes de una tarde, sin más pretensión que dejarlos anotados.',
    headings: [],
  },
  {
    title: 'El inventario como narrativa',
    excerpt: 'Apuntes de una tarde, sin más pretensión que dejarlos anotados.',
    section: 'analysis',
    author: AUTHOR_ID,
    headings: [
      'Cargar peso es contar algo',
      'La cuadrícula y el ritmo',
      'Cuando gestionar deja de ser jugar',
    ],
  },
  {
    title: 'La dificultad no es una barra',
    excerpt: 'Cargar objetos es cargar decisiones, y casi nadie diseña ese peso.',
    section: 'opinion',
    author: SECOND_AUTHOR_ID,
    headings: [
      'Fácil, normal, imposible',
      'Accesibilidad no es rebajar',
      'El público que nadie mide',
    ],
  },
  {
    title: 'Contra la palabra inmersión',
    excerpt: 'Tres niveles de dificultad son una respuesta cómoda a una pregunta difícil.',
    section: 'opinion',
    author: AUTHOR_ID,
    headings: [
      'Una palabra que ya no distingue',
      'Qué decimos cuando la usamos',
      'Alternativas más honestas',
    ],
  },
  {
    title: 'Los remakes no son restauraciones',
    excerpt: 'La usamos para todo, y por eso ya no distingue nada.',
    section: 'opinion',
    author: SECOND_AUTHOR_ID,
    headings: [
      'Restaurar y reescribir',
      'La nostalgia como argumento de venta',
      'Qué se pierde sin decirlo',
      'El original sigue existiendo',
    ],
  },
  {
    title: 'Apunte rápido sobre una demo',
    section: 'opinion',
    author: null,
    excerpt: 'Notas rápidas después de media hora con una demo.',
    headings: [],
  },
  {
    title: 'El sonido de los menús',
    excerpt: 'Rehacer un juego es opinar sobre él, aunque el anuncio diga lo contrario.',
    section: 'analysis',
    author: AUTHOR_ID,
    headings: [
      'Confirmar tiene un tono',
      'Silencio en la pausa',
      'Detalles que solo se notan si faltan',
    ],
  },
  {
    title: 'Jugar con el mando apagado',
    excerpt: 'Notas rápidas después de media hora con una demo.',
    section: 'opinion',
    author: SECOND_AUTHOR_ID,
    headings: [
      'Los momentos sin input',
      'Cuando el juego pide que mires',
      'La escena que no se puede saltar',
    ],
  },
];

fillers.forEach((filler, index) => {
  // Derived rather than random: the seed is idempotent through
  // `INSERT OR REPLACE`, which only works if a row keeps its identifier across
  // runs. The suffix is padded so the ids stay a fixed width.
  const suffix = String(index).padStart(2, '0');
  const fillerPostId = `f0000000-0000-4000-8000-0000000000${suffix}`;
  const fillerLocalizationId = `f1000000-0000-4000-8000-0000000000${suffix}`;
  const fillerRevisionId = `f2000000-0000-4000-8000-0000000000${suffix}`;

  // One day apart, walking backwards from the day before the named posts.
  const publishedAt = toDbTimestamp(new Date(Date.UTC(2026, 6, 20 - index, 12, 0, 0)));

  // A heading and a paragraph per section, so the outline has real anchors and
  // the reading time is derived from something worth reading.
  const body = filler.headings.flatMap((heading, headingIndex) => {
    const pair = String(headingIndex).padStart(2, '0');

    // Rotated rather than repeated. The first version put one sentence under
    // every heading of every post, and the result read as lorem ipsum — which
    // defeats a seed whose whole purpose is to be looked at. Offset by the post
    // index too, so two posts do not open with the same line.
    const paragraph = PARAGRAPHS[(index * 3 + headingIndex) % PARAGRAPHS.length]!;

    return [
      {
        type: 'heading' as const,
        attrs: { blockId: `f4${suffix}0000-0000-4000-8000-0000000000${pair}`, level: 2 as const },
        content: [{ type: 'text' as const, text: heading }],
      },
      {
        type: 'paragraph' as const,
        attrs: { blockId: `f5${suffix}0000-0000-4000-8000-0000000000${pair}` },
        content: [{ type: 'text' as const, text: paragraph }],
      },
    ];
  });

  const content = parseContentDoc({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { blockId: `f3000000-0000-4000-8000-0000000000${suffix}` },
        content: [
          {
            type: 'text',
            text: 'Notas sobre una parte del diseño que suele pasar desapercibida hasta que falla.',
          },
        ],
      },
      ...body,
    ],
  });

  push(
    db.insert(schema.posts).values({
      id: fillerPostId,
      section: filler.section,
      editorialState: 'active',
      coverMediaId: pushCover(fillerPostId, `relleno-${suffix}`, filler.section),
      ...(filler.author ? { authorId: filler.author } : {}),
    })
  );

  push(
    db.insert(schema.postLocalizations).values({
      id: fillerLocalizationId,
      postId: fillerPostId,
      locale: 'es',
      slug: `relleno-${suffix}`,
      status: 'published',
      publishedRevisionId: fillerRevisionId,
      firstPublishedAt: publishedAt,
      currentPublishedAt: publishedAt,
    })
  );

  push(
    db.insert(schema.postRevisions).values({
      id: fillerRevisionId,
      postLocalizationId: fillerLocalizationId,
      version: 1,
      title: filler.title,
      excerpt: filler.excerpt,
      contentJson: content,
      readingTimeMinutes: deriveReadingTime(content),
      tocJson: deriveToc(content),
    })
  );
});

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
 * A published series, in both languages, with four posts in it.
 *
 * It used to hold one post in one language. That was enough to prove the URL
 * resolved and nothing else: a collection of one cannot show an order, and a
 * collection in one language cannot show that the series page follows the same
 * bilingual rules as everything else.
 *
 * The extra members are filler posts rather than new ones, because a post
 * *belongs to* a collection rather than being owned by one, and reusing posts
 * that already exist on their own is what makes that visible.
 *
 * They are attached **out of publication order on purpose**: position 0 is the
 * named analysis, and the fillers that follow are not the three most recent.
 * `collection_posts.position` is what decides reading order, so anything that
 * quietly sorts a series by date instead shows itself here rather than in
 * production.
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
  db.insert(schema.collectionLocalizations).values({
    id: '9a3c6d4e-1f5b-427a-8c3d-8e9f0a1b2c3d',
    collectionId: COLLECTION_ID,
    locale: 'en',
    slug: 'sound-in-games',
    title: 'Sound in games',
    description: 'A series on how the worlds we play sound — and how they fall silent.',
    status: 'published',
    firstPublishedAt: PUBLISHED_AT,
  })
);

// The named analysis opens the series; three fillers follow it. The indices are
// deliberately not the three newest, so ordering by date rather than by
// `position` produces a visibly different list.
push(
  db.insert(schema.collectionPosts).values({
    collectionId: COLLECTION_ID,
    postId: POST_ID,
    position: 0,
  })
);

[10, 3, 5].forEach((filler, index) => {
  push(
    db.insert(schema.collectionPosts).values({
      collectionId: COLLECTION_ID,
      postId: `f0000000-0000-4000-8000-0000000000${String(filler).padStart(2, '0')}`,
      position: index + 1,
    })
  );
});

/**
 * One stored object, so the delivery route has something real to serve
 * (ADR-0033).
 *
 * A 1×1 PNG rather than a realistic photograph: the route's job is to find the
 * object, refuse the wrong content types and set the right headers, none of
 * which vary with the number of pixels. Embedding a real image would add
 * hundreds of kilobytes to the repository to test nothing extra.
 *
 * PNG rather than the WebP that ADR-0028 normalizes to, because a minimal valid
 * PNG can be written by hand and verified by eye. Both are on the serving
 * allow-list, and the route does not care which it is handed.
 *
 * The key follows the ADR-0028 convention exactly — `media/{yyyy}/{mm}/{id}.{ext}`
 * — because the delivery route reads the asset id back out of it to tag the
 * response for purging.
 */
const MEDIA_ID = '6d1f8a90-2b3c-4d5e-8f70-1a2b3c4d5e6f';
const MEDIA_KEY = `media/2026/08/${MEDIA_ID}.png`;

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

push(
  db.insert(schema.mediaAssets).values({
    id: MEDIA_ID,
    r2Key: MEDIA_KEY,
    altText: 'Un pixel de ejemplo',
    isOwnWork: true,
    contentType: 'image/png',
    width: 1,
    height: 1,
    sizeBytes: onePixelPng.byteLength,
  })
);

const mediaPath = path.join(process.cwd(), '.wrangler', 'seed-media.png');

mkdirSync(path.dirname(mediaPath), { recursive: true });
writeFileSync(mediaPath, onePixelPng);

// Registered with the covers rather than uploaded by a command of its own.
//
// It used to have a hard-coded `wrangler r2 object put` in `package.json`. When
// the covers arrived that line was replaced by the generated script — and this
// object, not being a cover, stopped being uploaded. Every local run still
// passed because the object was already in the local bucket from before; CI,
// starting clean, answered 404. Anything the seed writes to disk belongs on the
// same list, so there is one place to forget rather than two.
uploads.push({ key: MEDIA_KEY, file: mediaPath });

const outputPath = path.join(process.cwd(), '.wrangler', 'seed.sql');

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `-- Generated by scripts/seed.ts (ADR-0017). Do not edit by hand.\n${statements.join('\n')}\n`,
  'utf8'
);

/**
 * The R2 uploads, as a shell script rather than as inserts.
 *
 * `wrangler r2 object put` takes one object per invocation, and the number of
 * covers grows with the seed — hard-coding them in `package.json` the way the
 * single example object was would mean editing a script every time a post is
 * added. The seed knows what it wrote, so it writes the commands too.
 */
const uploadPath = path.join(process.cwd(), '.wrangler', 'seed-media.sh');

writeFileSync(
  uploadPath,
  [
    '#!/bin/sh',
    '# Generated by scripts/seed.ts. Do not edit by hand.',
    'set -e',
    ...uploads.map(
      ({ key, file }) =>
        `wrangler r2 object put "cesco-blog-media/${key}" --file="${path
          .relative(process.cwd(), file)
          .replace(/\\/g, '/')}" --content-type=image/png --local`
    ),
    '',
  ].join('\n'),
  'utf8'
);

console.log(`Wrote ${statements.length} statements to ${path.relative(process.cwd(), outputPath)}`);
console.log(
  `Wrote ${uploads.length} object uploads to ${path.relative(process.cwd(), uploadPath)}`
);
