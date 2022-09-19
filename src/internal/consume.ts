import type { Channel } from '../prelude.js'

/**
 * Consumes write and read from the channel.
 * @throws if there are no reads or no writes.
 * @internal
 */
export const consume =
  <T>(ch: Channel<T>): void => {
    const read = ch.reads.shift()
    if (!read) {
      throw new Error('No read.')
    }
    const write = ch.writes.shift()
    if (!write) {
      throw new Error('No write.')
    }
    const { value, consumed, enqueued } = write
    if (ch.cap === 0) {
      enqueued?.call(ch, undefined)
    } else if (ch.writes.length >= ch.cap) {
      ch.writes[ch.cap - 1].enqueued?.(undefined)
    }
    const done = ch.done && ch.writes.length === 0
    try {
      read.call(ch, { value, done })
      consumed?.call(ch, undefined)
    } catch (err) {
      consumed?.call(ch, err)
    }
  }
