import * as A from '@prelude/array'

export type Write<T> =
  | [ err: undefined, value: T, cb: () => void ]
  | [ err: Error, value: undefined, cb: () => void ]

export type Read<T> = (write: Write<T>, done: boolean) => void

export type Ch<T> = AsyncIterable<T> & {
  done: boolean,
  softLimit: number,
  hardLimit: number,
  reads: Read<T>[],
  writes: Write<T>[]
}

export type t<T> = Ch<T>

export type TOfCh<T> = T extends Ch<infer U> ? U : never

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

const write =
  <T>(ch: Ch<T>): Write<T> => {
    const _ = ch.writes.shift()
    if (!_) {
      throw new Error('Expected write.')
    }
    _[2]()
    return _
  }

// Only one of readers or writers can be non-empty.
const _send =
  <T>(ch: Ch<T>, wr: Write<T>, done = false): void => {
    if (ch.done) {
      throw new Error('Can\'t send on done channel.')
    }
    if (done) {
      ch.done = true
    }
    if (ch.reads.length > 0) {
      wr[2]()
      A.deleteSwapRandom(ch.reads)(wr, false)
      return
    }
    ch.writes.push(wr)
  }

export const send =
  <T>(ch: Ch<T>, value: T): Promise<void> => {
    const { hardLimit } = ch

    // Throw if hard limit has been reached.
    if (ch.writes.length >= hardLimit) {
      throw new Error(`Channel hard max limit ${hardLimit} overflow.`)
    }

    return new Promise(resolve => {
      _send(ch, [undefined, value, () => {
        resolve(undefined)
      }])
    })
  }

export const readable =
  <T>(ch: Ch<T>): boolean =>
    ch.writes.length > 0

// export const writable =
//   <T>(channel: Channel<T>, soft = true): boolean =>
//     soft ?
//       channel.queue.length < channel.softLimit :
//       channel.queue.length < channel.hardLimit

export const _next =
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

export const next =
  <T>(ch: Ch<T>): Promise<IteratorResult<T>> =>
    new Promise((resolve, reject) => {
      _next(ch, (_, done) => _[0] ? reject(_[0]) : resolve({ value: _[1], done }))
    })

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

export const select =
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

export const receive =
  <T>(ch: Ch<T>): Promise<T> =>
    next(ch)
      .then(({ value, done }) => {
        if (done) {
          throw new Error('Channel closed.')
        }
        return value
      })
