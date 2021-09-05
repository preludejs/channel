import * as A from '@prelude/array'
import type { Ch, TOfCh, Read, Write } from './prelude.js'
import readable from './readable.js'
import write from './write.js'

// TODO: all closed channels
const _select =
  <Chs extends Ch<any>[]>(chs: Chs, rd: Read<TOfCh<Chs[number]>>): void => {
    const ch = A.maybeSample(chs.filter(readable))
    if (ch) {
      const wr = write(ch)
      rd(wr, ch.done && chs.every(_ => _.done))
      return
    }
    const rds = chs.filter(_ => !_.done).map(ch => {
      const rd_ = (wr: Write<TOfCh<Chs[number]>>) => {
        unwind()
        rd(wr, ch.done && chs.every(_ => _.done))
      }
      ch.reads.push(rd_)
      return rd_
    })
    const unwind = () => rds.forEach((rd_, i) => A.swapDeleteFirst(chs[i].reads, _ => _ === rd_))
    if (rds.length === 0) {
      rd([new Error('All channels closed.'), undefined, () => undefined], true)
      return
    }
  }

const select =
  async <Args extends Ch<any>[]>(...channels: Args): Promise<IteratorResult<TOfCh<Args[number]>>> =>
    new Promise((resolve, reject) => {
      _select(channels, (write, done) => {
        if (typeof write[0] !== 'undefined') {
          reject(write[0])
          return
        }
        done ?
          resolve({ value: undefined, done: true }) :
          resolve({ value: write[1]! })
      })
    })

export default select
