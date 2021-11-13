import type { Ch, Read } from './prelude.js'
import readable from './readable.js'
import write from './write.js'

const _next =
  <T>(ch: Ch<T>, rd: Read<T>): void => {
    if (readable(ch)) {
      rd(write(ch), false)
      return
    }
    if (ch.done) {
      rd([new Error('Channel closed.'), undefined, () => undefined], true)
      return
    }
    ch.reads.push(rd)
  }

const next =
  <T>(ch: Ch<T>): Promise<IteratorResult<T>> =>
    new Promise((resolve, reject) => {
      _next(ch, (_, done) => _[0] ? reject(_[0]) : resolve({ value: _[1], done }))
    })

export default next
