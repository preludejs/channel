import { close } from './close.js'
import { next } from './next.js'
import { of } from './of.js'

/** @returns channel that closes after specified milliseconds. */
export const after =
  (milliseconds: number) => {
    const ch = of()
    const timeoutId = setTimeout(() => close(ch), milliseconds)
    next(ch)
      .then(() => {
        clearTimeout(timeoutId)
      })
    return ch
  }
