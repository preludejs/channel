import type { Channel, WriteAttempt } from '../prelude.js'

export const writeAttempt =
  <T, R>(ch: Channel<T>, value: T, cb: () => IteratorResult<R>): WriteAttempt<T, R> => ({
    type: 'write', ch, value, cb
  })
