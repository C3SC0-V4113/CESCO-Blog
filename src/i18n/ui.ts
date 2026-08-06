/**
 * UI string dictionaries (ADR-0027).
 *
 * Astro's i18n handles routing, not content, so translated interface copy lives
 * here. Spanish is the reference locale: `en` is typed against it, so a missing
 * English key is a TypeScript error rather than a silent fallback. A fallback
 * nobody sees is how half a bilingual site ends up in one language.
 *
 * Editorial content is never translated here — it lives in `post_revisions` per
 * localization. This file is only for chrome, labels, and fixed copy.
 *
 * The supported locale list lives in `./locales`, which runtime code can import
 * without pulling these dictionaries into its bundle.
 */

const es = {
  'nav.home': 'Inicio',
  'nav.blog': 'Blog',
  'nav.analysis': 'Análisis',
  'nav.opinion': 'Opiniones',
  'nav.series': 'Series',
  'nav.search': 'Buscar',
  'nav.menu': 'Menú',
  'nav.close': 'Cerrar',
  'nav.skipToContent': 'Saltar al contenido',

  'theme.toggle': 'Cambiar tema',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',

  'locale.switch': 'Cambiar idioma',
  'locale.es': 'Español',
  'locale.en': 'English',

  'post.readingTime': 'min de lectura',
  'post.publishedOn': 'Publicado el',
  'post.updatedOn': 'Actualizado el',
  'post.by': 'Por',
  'post.tableOfContents': 'Contenido',
  'post.copyLink': 'Copiar enlace',
  'post.linkCopied': 'Enlace copiado',
  'post.tags': 'Etiquetas',
  'post.partOfSeries': 'Parte de la serie',
  'post.previousInSeries': 'Anterior en la serie',
  'post.nextInSeries': 'Siguiente en la serie',

  'analysis.platform': 'Plataforma',
  'analysis.playtime': 'Tiempo jugado',
  'analysis.playtimeHours': 'horas',
  'analysis.completion': 'Estado',
  'analysis.completion.completed': 'Completado',
  'analysis.completion.main_story': 'Historia principal',
  'analysis.completion.partial': 'Parcial',
  'analysis.completion.abandoned': 'Abandonado',
  'analysis.completion.ongoing': 'En curso',

  // Required to be visible on the page, not merely stored (ADR-0012).
  'disclosure.reviewCopy': 'El estudio facilitó una copia de este juego para su análisis.',
  'disclosure.reviewCopyFrom': 'Copia de análisis facilitada por',

  'game.developer': 'Desarrollador',
  'game.publisher': 'Distribuidor',
  'game.releaseDate': 'Fecha de lanzamiento',
  'game.platforms': 'Plataformas',
  'game.genres': 'Géneros',

  'listing.empty': 'Todavía no hay publicaciones en este idioma.',
  'listing.previous': 'Anterior',
  'listing.next': 'Siguiente',
  'listing.latest': 'Lo último',
  'listing.featured': 'Destacado',
  'listing.pagination': 'Paginación',
  'listing.morePages': 'Más páginas',
  'listing.goToPage': 'Ir a la página',

  'error.404.title': 'Esta página no existe',
  'error.404.body': 'Esta dirección no corresponde a ninguna publicación.',
  'error.404.action': 'Ir al inicio',
  // Deliberately different from 404: the content existed and was withdrawn.
  'error.410.title': 'Esta publicación ya no está disponible',
  'error.410.body': 'Se retiró de forma permanente y no volverá a esta dirección.',
  'error.410.action': 'Ver publicaciones recientes',

  'footer.about': 'Acerca de',
  'footer.contact': 'Contacto',
  'footer.privacy': 'Privacidad',
  'footer.editorialPolicy': 'Política editorial',
  'footer.disclosures': 'Divulgaciones',
  'footer.rss': 'RSS',
} as const;

const en = {
  'nav.home': 'Home',
  'nav.blog': 'Blog',
  'nav.analysis': 'Analysis',
  'nav.opinion': 'Opinion',
  'nav.series': 'Series',
  'nav.search': 'Search',
  'nav.menu': 'Menu',
  'nav.close': 'Close',
  'nav.skipToContent': 'Skip to content',

  'theme.toggle': 'Toggle theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',

  'locale.switch': 'Change language',
  'locale.es': 'Español',
  'locale.en': 'English',

  'post.readingTime': 'min read',
  'post.publishedOn': 'Published on',
  'post.updatedOn': 'Updated on',
  'post.by': 'By',
  'post.tableOfContents': 'Contents',
  'post.copyLink': 'Copy link',
  'post.linkCopied': 'Link copied',
  'post.tags': 'Tags',
  'post.partOfSeries': 'Part of the series',
  'post.previousInSeries': 'Previous in series',
  'post.nextInSeries': 'Next in series',

  'analysis.platform': 'Platform',
  'analysis.playtime': 'Time played',
  'analysis.playtimeHours': 'hours',
  'analysis.completion': 'Progress',
  'analysis.completion.completed': 'Completed',
  'analysis.completion.main_story': 'Main story',
  'analysis.completion.partial': 'Partial',
  'analysis.completion.abandoned': 'Abandoned',
  'analysis.completion.ongoing': 'Ongoing',

  'disclosure.reviewCopy': 'The studio provided a copy of this game for review.',
  'disclosure.reviewCopyFrom': 'Review copy provided by',

  'game.developer': 'Developer',
  'game.publisher': 'Publisher',
  'game.releaseDate': 'Release date',
  'game.platforms': 'Platforms',
  'game.genres': 'Genres',

  'listing.empty': 'Nothing published in this language yet.',
  'listing.previous': 'Previous',
  'listing.next': 'Next',
  'listing.latest': 'Latest',
  'listing.featured': 'Featured',
  'listing.pagination': 'Pagination',
  'listing.morePages': 'More pages',
  'listing.goToPage': 'Go to page',

  'error.404.title': 'This page does not exist',
  'error.404.body': 'The address you are looking for does not match any post.',
  'error.404.action': 'Go to the home page',
  'error.410.title': 'This post is no longer available',
  'error.410.body': 'It was permanently withdrawn and will not return to this address.',
  'error.410.action': 'See recent posts',

  'footer.about': 'About',
  'footer.contact': 'Contact',
  'footer.privacy': 'Privacy',
  'footer.editorialPolicy': 'Editorial policy',
  'footer.disclosures': 'Disclosures',
  'footer.rss': 'RSS',
  // The `satisfies` below is what makes a missing key a compile error.
} as const satisfies Record<keyof typeof es, string>;

export const ui = { es, en } as const;

export type UiKey = keyof typeof es;
