import { consume } from './internal/consume.js'
import type { Channel } from './prelude.js'

export const next =
  <T>(ch: Channel<T>): Promise<IteratorResult<T>> =>
    new Promise(resolve => {
      if (ch.done && ch.writes.length === 0) {
        resolve({ done: true, value: undefined })
        return
      }
      ch.reads.push(resolve)
      if (ch.writes.length > 0) {
        consume(ch)
      }
    })
