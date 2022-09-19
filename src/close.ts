import { removeRead } from './internal/remove-read.js'
import { removeWrite } from './internal/remove-write.js'
import type { Channel } from './prelude.js'

/** Closes channel removing all writes and reads. */
export const close =
  <T>(ch: Channel<T>) => {
    ch.done = true
    while (ch.writes.length > 0) {
      removeWrite(ch, ch.writes[0])
    }
    while (ch.reads.length > 0) {
      removeRead(ch, ch.reads[0])
    }
  }
