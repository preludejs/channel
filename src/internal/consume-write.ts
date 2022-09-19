import type { Channel } from '../prelude.js'

/**
 * Consumes write from channel.
 * @internal
 */
export const consumeWrite =
  <T>(ch: Channel<T>) => {
    const write = ch.writes.shift()
    if (!write) {
      throw new Error('no write to consume')
    }
    const { value, consumed, enqueued } = write
    if (ch.cap === 0) {
      enqueued?.call(ch, undefined)
    } else if (ch.writes.length >= ch.cap) {
      ch.writes[ch.cap - 1].enqueued?.(undefined)
    }
    consumed?.call(ch, undefined)
    return value
  }
