import type { Channel, ReadAttempt } from '../prelude.js'

export const readAttempt =
  <T, R>(ch: Channel<T>, cb: (result: IteratorResult<T>) => IteratorResult<R>): ReadAttempt<T, R> => ({
    type: 'read', ch, cb
  })
