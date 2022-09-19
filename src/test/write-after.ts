import type { Channel } from '../prelude.js'
import { write } from '../write.js'

export const writeAfter =
  <T>(ch: Channel<T>, value: T, milliseconds: number) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        write(ch, value)
          .then(() => {
            resolve(undefined)
          })
          .catch(reject)
      }, milliseconds)
    })
