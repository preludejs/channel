import type { Channel, Write } from '../prelude.js'

/**
 * Removes write from channel.
 * No-op if write is not found.
 * @internal
 */
export const removeWrite =
  <T>(ch: Channel<T>, write: Write<T>, err?: unknown) => {
    const i = ch.writes.lastIndexOf(write)
    if (i === -1) {
      return
    }
    ch.writes[i]?.enqueued?.call(ch, err)
    ch.writes.splice(i, 1)
  }
