import { next } from './next.js'
import type { Channel } from './prelude.js'

export const of =
  <T = unknown>(cap = 0): Channel<T> => ({
    type: 'channel',
    reads: [],
    writes: [],
    done: false,
    cap,
    next() {
      return next(this)
    },
    [Symbol.asyncIterator]: function () {
      return {
        [Symbol.asyncIterator]() {
          return this
        },
        next: () => next(this),
        return: async () => {
          this.done = true
          return { done: true as const, value: undefined }
        },
        throw: async (err: unknown) => {
          this.done = true
          throw err
        }
      }
    }
  })
