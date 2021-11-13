import type { Ch } from './prelude.js'

/** @returns `true` if there are pending writes, `false` otherwise. */
const readable =
  <T>(ch: Ch<T>): boolean =>
    ch.writes.length > 0

export default readable
