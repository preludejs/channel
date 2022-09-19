import { ChannelClosedError, type Channel, type Write } from './prelude.js'
import { removeWrite } from './internal/remove-write.js'

/**
 * Sets channel to done state.
 * Removes all writes beyond capacity with ChannelClosedError.
 * @param ch
 * @returns
 */
export const done =
  <T>(ch: Channel<T>) => {
    if (ch.done) {
      return
    }
    ch.done = true
    while (ch.writes.length > ch.cap) {
      removeWrite(ch, ch.writes.pop() as Write<T>, new ChannelClosedError)
    }
  }
