import { ChannelClosedError, type Channel } from './prelude.js'
import { consume } from './internal/consume.js'
import { consumeRead } from './internal/consume-read.js'

export const write =
  <T>(ch: Channel<T>, value: T) =>
    new Promise((resolve, reject) => {
      if (ch.done) {
        reject(new ChannelClosedError())
        return
      }
      if (ch.cap === 0 && ch.reads.length > 0) {
        consumeRead(ch, { value })
        resolve(undefined)
        return
      } else if (ch.writes.length < ch.cap) {
        ch.writes.push({ value })
        resolve(undefined)
        if (ch.reads.length > 0) {
          consume(ch)
        }
        return
      }
      ch.writes.push({ value, enqueued: resolve })
    })
