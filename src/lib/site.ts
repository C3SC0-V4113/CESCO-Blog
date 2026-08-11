/**
 * Facts about the site itself.
 *
 * Here rather than in the UI dictionary (ADR-0027) because none of it is
 * translated: a name that changed between locales would not be a name, and the
 * contact address is the same address whoever is reading.
 */

/**
 * `Checkpoint`, not the author's name.
 *
 * ADR-0016 chose `checkpoint.cescovalle.com` and gave the reason the wordmark
 * inherits: the word reads identically in Spanish and English, which a
 * bilingual masthead needs and "Cesco Blog" does not have — it names a person
 * in one language and a category in the other.
 */
export const SITE_NAME = 'Checkpoint';

/** Editorial contact, published on the contact page (ADR-0018). */
export const CONTACT_EMAIL = 'cescovalledev@gmail.com';
