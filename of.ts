import type { Ch } from './prelude.js'
import next from './next.js'

export const of =
  <T>(softLimit = Infinity, hardLimit = Infinity): Ch<T> => {
    const ch = {
      done: false,
      softLimit,
      hardLimit,
      reads: [],
      writes: [],
      [Symbol.asyncIterator]: () => ({
        next: () => next(ch)
      })
    }
    return ch
  }

export default of
