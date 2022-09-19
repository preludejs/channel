import { next } from './next.js'
import type { Channel } from './prelude.js'

/**
 * Reads value from channel.
 * @throws if channel is closed.
 * @see {@link maybeRead}
 * @returns value from channel.
 */
export const read =
  <T>(ch: Channel<T>): Promise<T> =>
    next(ch)
      .then(_ => {
        if (_.done) {
          throw new Error('Channel closed.')
        }
        return _.value
      })
