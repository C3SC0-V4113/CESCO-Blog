/**
 * Dictionary keys for the two error answers of ADR-0010.
 *
 * Shared by the error state, which renders the copy, and the main layout, which
 * titles the document with it. Two copies of the map would drift the first time
 * one status gained a different headline.
 *
 * Spelled out rather than built by interpolation: written as
 * `error.${status}.title` the key is a template literal that TypeScript cannot
 * check against the dictionary, which is the one guarantee ADR-0027 buys.
 */

export const errorCopy = {
  404: { title: 'error.404.title', body: 'error.404.body', action: 'error.404.action' },
  410: { title: 'error.410.title', body: 'error.410.body', action: 'error.410.action' },
} as const;

export type ErrorStatus = keyof typeof errorCopy;

/** Narrows a response status to one the error state has copy for. */
export function isErrorStatus(status: number): status is ErrorStatus {
  return status in errorCopy;
}
