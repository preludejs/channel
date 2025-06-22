export type Thunk<R = void> = () => R

export type Undo = Thunk<void>

export type Done = (err?: unknown) => void

export type Read<T> = (result: IteratorResult<T>) => void

export type Write<T> = {
  value: T

  /** Callback to notify when the write has been enqueued. */
  enqueued?: Done

  /** Callback to notify when the write has been consumed. */
  written?: Done
}

export type Channel<T> = AsyncIterableIterator<T> & {
  type: 'Channel'
  cap: number
  doneWriting: boolean
  reads: Read<T>[]
  writes: Write<T>[]
  doneWritingCallbacks: Done[]
}

export { Channel as T }

export type ReadAttempt<T, R> = {
  type: 'ReadAttempt'
  channel: Channel<T>
  perform: (result: IteratorResult<T>) => IteratorResult<R>
}

export type WriteAttempt<T, R> = {
  type: 'WriteAttempt'
  channel: Channel<T>
  value: T
  perform: (value: T) => IteratorResult<R>
}

export type Attempt = Channel<any> | ReadAttempt<any, any> | WriteAttempt<any, any>

export type Attempted<A extends Attempt> =
  A extends Channel<infer T>
    ? T
    : A extends ReadAttempt<any, infer R>
      ? R
      : A extends WriteAttempt<any, infer R>
        ? R
        : never

export const readAttempt = <T, R>(
  channel: Channel<T>,
  perform: (result: IteratorResult<T>) => IteratorResult<R>
): ReadAttempt<T, R> => {
  return {
    type: 'ReadAttempt',
    channel,
    perform
  }
}

export const writeAttempt = <T, R>(
  channel: Channel<T>,
  value: T,
  perform: (value: T) => IteratorResult<R>
): WriteAttempt<T, R> => {
  return {
    type: 'WriteAttempt',
    channel,
    value,
    perform
  }
}

/** @returns `true` if channels has been closed and there are no pending writes. */
export const done = <T>(channel: Channel<T>) => channel.doneWriting && channel.writes.length === 0

const consume = <T>(channel: Channel<T>) => {
  if (channel.reads.length === 0) {
    throw new Error('no reads')
  }
  if (channel.writes.length === 0) {
    throw new Error('no writes')
  }
  const read = channel.reads.shift() as Read<T>
  const write = channel.writes.shift() as Write<T>
  if (channel.cap === 0) {
    write.enqueued?.call(channel)
    write.written?.call(channel)
  } else {
    // For buffered channels, the consumed write was already enqueued
    write.written?.call(channel)
    // If there are writes waiting beyond capacity, notify the next one
    if (channel.writes.length >= channel.cap) {
      channel.writes[channel.cap - 1].enqueued?.call(channel)
    }
  }
  read.call(channel, { value: write.value })
}

export const next = <T>(channel: Channel<T>): Promise<IteratorResult<T>> =>
  new Promise(resolve => {
    if (done(channel)) {
      resolve({ done: true, value: undefined })
      return
    }
    channel.reads.push(resolve)
    if (channel.writes.length > 0) {
      consume(channel)
    }
  })

/**
 * Closes writing only.
 *
 * Writes beyond capacity are settled with optional err.
 *
 * If there are no pending writes channel is effectively done - closed for reading and writing.
 *
 * @see {@link close} for closing channel for reading and writing.
 */
export const closeWriting = <T>(channel: Channel<T>, err?: unknown): void => {
  if (channel.doneWriting) {
    return
  }
  channel.doneWriting = true
  while (true) {
    const cb = channel.doneWritingCallbacks.pop()
    if (!cb) {
      break
    }
    cb.call(channel, err)
  }
  while (channel.writes.length > channel.cap) {
    const write = channel.writes.pop() as Write<T>
    write.enqueued?.call(channel, err)
    write.written?.call(channel, err)
  }
  if (channel.writes.length === 0) {
    while (channel.reads.length > 0) {
      const read = channel.reads.pop() as Read<T>
      read({ done: true, value: undefined })
    }
  }
}

/**
 * Closes channel for both reading and writing.
 *
 * @see {@link closeWriting} for closing channel for writing only.
 */
export const close = <T>(channel: Channel<T>, err?: unknown) => {
  closeWriting(channel, err)
  while (true) {
    const write = channel.writes.pop()
    if (!write) {
      break
    }
    write.enqueued?.call(channel, err)
    write.written?.call(channel, err)
  }
  while (true) {
    const read = channel.reads.pop()
    if (!read) {
      break
    }
    read?.call(channel, { done: true, value: undefined })
  }
}

const return_ = async <T>(channel: Channel<T>, value?: any) => {
  close(channel)
  return { done: true, value }
}

export { return_ as return }

const throw_ = async <T>(channel: Channel<T>, err?: any) => {
  close(channel, err)
  return { done: true, value: err }
}

export { throw_ as throw }

export const of = <T>(cap = 0): Channel<T> => ({
  type: 'Channel',
  cap,
  doneWriting: false,
  reads: [],
  writes: [],
  doneWritingCallbacks: [],
  [Symbol.asyncIterator]() {
    return this
  },
  next() {
    return next(this)
  },
  return(value?: any) {
    return return_(this, value)
  },
  throw(err?: any) {
    return throw_(this, err)
  }
})

export const ofIterable = <T, R extends Channel<T>>(
  iterable: Iterable<T>,
  cap = 0,
  constructor: (cap?: number) => R = of as any
): R => {
  const channel = constructor(cap)
  const produce = async () => {
    for (const value of iterable) {
      if (channel.doneWriting) {
        break
      }
      await Promise.resolve().then(() => write(channel, value))
    }
  }
  produce().finally(() => {
    closeWriting(channel)
  })
  return channel
}

export const ofAsyncIterable = <T, R extends Channel<T> = Channel<T>>(
  asyncIterable: AsyncIterable<T>,
  cap = 0,
  constructor: (cap?: number) => R = of as any
): R => {
  const channel = constructor(cap)
  const produce = async () => {
    for await (const value of asyncIterable) {
      if (channel.doneWriting) {
        break
      }
      await write(channel, value)
    }
  }
  produce().finally(() => {
    closeWriting(channel)
  })
  return channel
}

export const consumeRead = <T>(channel: Channel<T>, result: IteratorResult<T>): void => {
  const read = channel.reads.shift()
  if (!read) {
    throw new Error('Expected read to consume.')
  }
  read(result)
}

export const consumeWrite = <T>(channel: Channel<T>): T => {
  const write = channel.writes.shift()
  if (!write) {
    throw new Error('Expected write to consume.')
  }
  if (channel.cap === 0) {
    write.enqueued?.call(channel)
  } else if (channel.writes.length >= channel.cap) {
    // After consuming, the write that was at position #cap is now at #cap-1
    // and should be notified that it's enqueued (entered the buffer)
    channel.writes[channel.cap - 1].enqueued?.call(channel)
  }
  write.written?.call(channel)
  return write.value
}

export const write = <T>(channel: Channel<T>, value: T): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (channel.doneWriting) {
      reject(new Error('Channel closed.'))
      return
    }
    if (channel.cap === 0 && channel.reads.length > 0) {
      consumeRead(channel, { value })
      resolve(undefined)
      return
    } else if (channel.writes.length < channel.cap) {
      channel.writes.push({ value })
      resolve(undefined)
      if (channel.reads.length > 0) {
        consume(channel)
      }
      return
    }
    channel.writes.push({
      value,
      enqueued: (err: unknown) => {
        if (err) {
          reject(err)
        } else {
          resolve(undefined)
        }
      }
    })
  })
}

/**
 * Attempts to write a value to the channel without throwing.
 * @returns Promise<boolean> - true if write succeeded, false if channel is closed
 */
export const maybeWrite = async <T>(channel: Channel<T>, value: T): Promise<boolean> => {
  try {
    await write(channel, value)
    return true
  } catch {
    return false
  }
}

/** Attempts to write a value to the channel ignoring result. */
export const writeIgnore = <T>(channel: Channel<T>, value: T): void => {
  write(channel, value).catch(() => {
    // no-op
  })
}

/** @returns all values that was possible to read immediatelly, aka all pending writes. */
export const consumeWrites = <T>(channel: Channel<T>): T[] => {
  const values: T[] = []
  while (channel.writes.length > 0) {
    values.push(consumeWrite(channel))
  }
  return values
}

/**
 * Registers callback to be called when channel has done writing.
 * Callback is called immediatelly if channel is already closed for writing.
 * @returns undo function that unregisters callback.
 */
export const onceDoneWriting = <T>(channel: Channel<T>, done: Done): Undo => {
  if (channel.doneWriting) {
    done()
    return () => {}
  }
  channel.doneWritingCallbacks.push(done)
  return () => {
    const i = channel.doneWritingCallbacks.indexOf(done)
    if (i === -1) {
      return
    }
    channel.doneWritingCallbacks.splice(i, 1)
  }
}

/**
 * Returns an async iterable with Go-like semantics.
 *
 * Unlike the default async iteration (`for await (const x of channel)`),
 * breaking out of a `.range` iteration will NOT close the channel.
 *
 * @example
 * ```typescript
 * // JavaScript semantics (default) - closes channel on break
 * for await (const value of channel) {
 *   if (value === target) break; // Channel gets closed
 * }
 *
 * // Go semantics via .range - keeps channel open on break
 * for await (const value of channel.range) {
 *   if (value === target) break; // Channel stays open
 * }
 * ```
 */
export const range = <T>(channel: Channel<T>): AsyncIterable<T> => {
  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<T>> {
          return next(channel)
        },
        async return(value?: any) {
          // Go semantics: don't close the channel
          return { done: true, value }
        },
        async throw(err?: any) {
          // Go semantics: don't close the channel
          return { done: true, value: err }
        }
      }
    }
  }
}

export const maybeRead = async <T>(channel: Channel<T>): Promise<undefined | T> => {
  const result = await next(channel)
  return result.done ? undefined : result.value
}

/** @throws if channel is closed. */
export const read = async <T>(channel: Channel<T>): Promise<T> => {
  const result = await next(channel)
  if (result.done) {
    throw new Error('Channel closed.')
  }
  return result.value
}

/**
 * Removes read from channel.
 * No-op if not found.
 * @internal
 */
const removeRead = <T>(channel: Channel<T>, read: Read<T>): void => {
  const i = channel.reads.indexOf(read)
  if (i === -1) {
    return
  }
  channel.reads.splice(i, 1)
}

/**
 * Pushes read to the channel.
 * @returns undo operation.
 */
export const pushRead = <T>(channel: Channel<T>, read: Read<T>): Undo => {
  if (channel.writes.length > 0) {
    throw new Error('Expected no writes to push read.')
  }
  if (done(channel)) {
    read({ done: true, value: undefined })
    return () => {}
  }
  channel.reads.push(read)
  return () => {
    removeRead(channel, read)
  }
}

/**
 * Removes write from channel.
 * No-op if write is not found.
 * @internal
 */
const removeWrite = <T>(channel: Channel<T>, write: Write<T>, err?: unknown): void => {
  const i = channel.writes.lastIndexOf(write)
  if (i === -1) {
    return
  }

  // For unbuffered channels, call enqueued callback
  // For buffered channels, call enqueued callback if the write was actually in the buffer
  if (channel.cap === 0 || i < channel.cap) {
    channel.writes[i].enqueued?.call(channel, err)
  }
  channel.writes[i].written?.call(channel, err)

  channel.writes.splice(i, 1)
}

/**
 * Pushes write to the channel.
 * @returns undo operation.
 */
export const pushWrite = <T>(channel: Channel<T>, write: Write<T>): Undo => {
  if (channel.reads.length > 0) {
    throw new Error('Expected no reads to push write.')
  }
  if (channel.doneWriting) {
    write.enqueued?.call(channel, new Error('Channel closed.'))
    write.written?.call(channel, new Error('Channel closed.'))
    return () => {}
  }
  channel.writes.push(write)
  return () => {
    removeWrite(channel, write)
  }
}

export async function* select<Attempts extends Attempt[]>(
  ...attempts: Attempts
): AsyncGenerator<Attempted<Attempts[number]>> {
  while (true) {
    const result = await selectNext(...attempts)
    if (result.done) {
      break
    }
    yield result.value
  }
}

export async function selectNext<Attempts extends Attempt[]>(
  ...attempts: Attempts
): Promise<IteratorResult<Attempted<Attempts[number]>>> {
  // Please note there is no time gap between maybeSelect and selectAsync setting up listeners.
  //
  // Single threaded nature of JavaScript runtime doesn't allow for any pre-emptive execution of other code before it completes.
  //
  // Function `maybeSelect` is synchronous.
  //
  // Function `selectAsync` is asynchronous, however it's setup involves creating Promise with callback
  // that runs synchronously when the Promise is created.
  //
  // Therefore setup is done in syncronous code path which doesn't leave space for race conditions.
  return maybeSelect(attempts) ?? (await selectAsync(attempts))
}

export function selectAsync<Attempts extends Attempt[]>(
  attempts: Attempts
): Promise<IteratorResult<Attempted<Attempts[number]>>> {
  return new Promise((resolve, reject) => {
    // This callback executes synchronously when the Promise is created.
    // All listener setup below happens immediately, with no opportunity
    // for other code to preempt and create race conditions.
    const undos: Thunk[] = []
    let settled = false

    const cleanup = () => {
      if (settled) {
        return
      }
      settled = true
      for (const undo of undos) {
        try {
          undo()
        } catch (err) {
          // Ignore cleanup errors to prevent masking the original error
          console.warn('Error during select cleanup:', err)
        }
      }
    }

    const safeResolve = (value: IteratorResult<Attempted<Attempts[number]>>) => {
      cleanup()
      resolve(value)
    }

    const safeReject = (err: unknown) => {
      cleanup()
      reject(err)
    }

    try {
      for (const attempt of attempts) {
        switch (attempt.type) {
          case 'Channel':
            undos.push(
              pushRead(attempt, result => {
                safeResolve(result as IteratorResult<Attempted<Attempts[number]>>)
              })
            )
            break
          case 'WriteAttempt':
            undos.push(
              pushWrite(attempt.channel, {
                value: attempt.value,
                enqueued: (err: unknown) => {
                  if (err) {
                    safeReject(err)
                    return
                  }
                  safeResolve(attempt.perform(attempt.value) as IteratorResult<Attempted<Attempts[number]>>)
                }
              })
            )
            break
          case 'ReadAttempt':
            undos.push(
              pushRead(attempt.channel, result => {
                safeResolve(attempt.perform(result) as IteratorResult<Attempted<Attempts[number]>>)
              })
            )
            break
          default:
            throw new Error('Invalid attempt.')
        }
      }
    } catch (err) {
      safeReject(err)
    }
  })
}

export function maybeSelect<Attempts extends Attempt[]>(
  attempts: Attempts
): undefined | IteratorResult<Attempted<Attempts[number]>> {
  const n = attempts.length
  // Create a copy to avoid mutating the original array
  const shuffled = [...attempts]

  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (n - i))
    const attempt = shuffled[j] as Attempts[number]
    switch (attempt.type) {
      case 'Channel':
        if (attempt.writes.length > 0) {
          return { value: consumeWrite(attempt) }
        }
        break
      case 'WriteAttempt':
        if (attempt.channel.cap === 0 && attempt.channel.reads.length > 0) {
          consumeRead(attempt.channel, { value: attempt.value })
          return attempt.perform(attempt.value)
        } else if (attempt.channel.writes.length < attempt.channel.cap) {
          pushWrite(attempt.channel, { value: attempt.value })
          return attempt.perform(attempt.value)
        }
        break
      case 'ReadAttempt':
        if (attempt.channel.writes.length > 0) {
          const value = consumeWrite(attempt.channel)
          return attempt.perform({ value })
        }
        break
      default:
        throw new Error('Invalid attempt.')
    }
    shuffled[j] = shuffled[i]
    shuffled[i] = attempt
  }
  return
}
