import type { Channel } from '../prelude.js'

/**
 * Consumes read from channel.
 * @internal
 */
export const consumeRead =
  <T>(ch: Channel<T>, result: IteratorResult<T>) => {
    const read = ch.reads.shift()
    if (!read) {
      throw new Error('No read to consume.')
    }
    read(result)
  }
