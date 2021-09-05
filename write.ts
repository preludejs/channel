import type { Ch, Write } from './prelude.js'

/**
 * Picks write for processing.
 * @private
 */
const write =
  <T>(ch: Ch<T>): Write<T> => {
    const wr = ch.writes.shift()
    if (!wr) {
      throw new Error('Expected write.')
    }
    wr[2]()
    return wr
  }

export default write
