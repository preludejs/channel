import type { Write, Read, Ch, t, TOfCh } from './prelude.js'
import readable from './readable.js'
import send from './send.js'
import next from './next.js'
import select from './select.js'
import of from './of.js'

export {
  of,
  Write,
  Read,
  TOfCh,
  Ch,
  next,
  t,
  send,
  readable,
  select
}

// export const writable =
//   <T>(channel: Channel<T>, soft = true): boolean =>
//     soft ?
//       channel.queue.length < channel.softLimit :
//       channel.queue.length < channel.hardLimit

export const receive =
  <T>(ch: Ch<T>): Promise<T> =>
    next(ch).then(({ value, done }) => {
      if (done) {
        throw new Error('Channel closed.')
      }
      return value
    })
