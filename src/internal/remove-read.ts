import type { Channel, Read } from '../prelude.js'

/**
 * Removes read from channel.
 * No-op if not found.
 * @internal
 */
export const removeRead =
  <T>(ch: Channel<T>, read: Read<T>) => {
    const i = ch.reads.indexOf(read)
    if (i === -1) {
      return
    }
    ch.reads.splice(i, 1)
  }
