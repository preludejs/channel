import { of } from './of.js'
import { write } from './write.js'

/** @returns channel from provided async iterable with specified capacity. */
export const ofAsyncIterable =
  function <T>(values: AsyncIterable<T>, cap = 0) {
    const ch = of<T>(cap)
    const produce =
      async () => {
        for await (const value of values) {
          if (ch.done) {
            break
          }
          await write(ch, value)
        }
      }
    produce()
      .finally(() => {
        ch.done = true
      })
    return ch
  }
