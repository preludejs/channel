import { of } from './of.js'
import { write } from './write.js'

/** @returns channel from provided iterable with specified capacity. */
export const ofIterable =
  function <T>(values: Iterable<T>, cap = 0) {
    const ch = of<T>(cap)
    const produce =
      async () => {
        for (const value of values) {
          if (ch.done) {
            break
          }
          await Promise
            .resolve()
            .then(() => write(ch, value))
        }
      }
    produce()
      .finally(() => {
        ch.done = true
      })
    return ch
  }
