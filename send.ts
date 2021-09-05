import * as A from '@prelude/array'
import type { Ch, Write } from './prelude.js'

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

/**
 * Sends value on the channel.
 * Returns promise which resolves once value has been read.
 * @throws if buffer limit has been reached.
 */
const send =
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

export default send
