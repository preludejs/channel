import type { Undo, Done, Read, Write } from './channel.js'
import * as Ch from './channel.js'

export class AttemptBase {}

export class ReadAttempt<T, R> extends AttemptBase {
  constructor(
    public readonly channel: Channel<T>,
    public readonly perform: (result: IteratorResult<T>) => IteratorResult<R>
  ) {
    super()
  }
}

export class WriteAttempt<T, R> extends AttemptBase {
  constructor(
    public readonly channel: Channel<T>,
    public readonly value: T,
    public readonly perform: (value: T) => IteratorResult<R>
  ) {
    super()
  }
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

export class Channel<T> implements AsyncIterableIterator<T> {
  cap: number
  doneWriting: boolean
  reads: Read<T>[]
  writes: Write<T>[]
  doneWritingCallbacks: Done[]

  constructor(cap = 0) {
    this.cap = cap
    this.doneWriting = false
    this.reads = []
    this.writes = []
    this.doneWritingCallbacks = []
  }

  /** @returns number of pending reads. */
  get pendingReads() {
    return this.reads.length
  }

  /** @returns number of pending writes. */
  get pendingWrites() {
    return this.writes.length
  }

  [Symbol.asyncIterator]() {
    return this
  }

  next(): Promise<IteratorResult<T>> {
    return Ch.next(this)
  }

  return(value?: any) {
    return Ch.return(this, value)
  }

  throw(err?: any) {
    return Ch.throw(this, err)
  }

  /** @returns `true` if channels has been closed and there are no pending writes. */
  get done() {
    return Ch.done(this)
  }

  /**
   * Closes writing only.
   *
   * Writes beyond capacity are settled with optional err.
   *
   * If there are no pending writes channel is effectively done - closed for reading and writing.
   *
   * @see {@link close} for closing channel for reading and writing.
   */
  closeWriting(err?: unknown) {
    Ch.closeWriting(this, err)
  }

  /**
   * Closes channel for both reading and writing.
   *
   * @see {@link closeWriting} for closing channel for writing only.
   */
  close(err?: unknown) {
    Ch.close(this, err)
  }

  /**
   * Registers callback to be called when channel has done writing.
   * Callback is called immediatelly if channel is already closed for writing.
   * @returns undo function that unregisters callback.
   */
  onceDoneWriting(done: Done): Undo {
    return Ch.onceDoneWriting(this, done)
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
  get range(): AsyncIterable<T> {
    return Ch.range(this)
  }

  /** @throws if channel is closed. */
  async read(): Promise<T> {
    return Ch.read(this)
  }

  async maybeRead(): Promise<undefined | T> {
    return Ch.maybeRead(this)
  }

  /** @returns all values that was possible to read immediatelly, aka all pending writes. */
  consumeWrites(): T[] {
    const values: T[] = []
    while (this.writes.length > 0) {
      values.push(this.consumeWrite())
    }
    return values
  }

  readAttempt<R>(perform: (result: IteratorResult<T>) => IteratorResult<R>) {
    return new ReadAttempt(this, perform)
  }

  write(value: T) {
    return Ch.write(this, value)
  }

  async maybeWrite(value: T) {
    return this.write(value)
      .then(() => true)
      .catch(() => false)
  }

  writeIgnore(value: T) {
    this.write(value).catch(() => {})
  }

  /**
   * Attempts to write a value to the channel without throwing.
   * @returns Promise<boolean> - true if write succeeded, false if channel is closed
   */
  async tryWrite(value: T): Promise<boolean> {
    try {
      await this.write(value)
      return true
    } catch {
      return false
    }
  }

  writeAttempt<R>(value: T, perform: (value: T) => IteratorResult<R>) {
    return new WriteAttempt(this, value, perform)
  }

  /**
   * Pushes read to the channel.
   * @returns undo operation.
   */
  pushRead(read: Read<T>): Undo {
    return Ch.pushRead(this, read)
  }

  /**
   * Pushes write to the channel.
   * @returns undo operation.
   */
  pushWrite(write: Write<T>): Undo {
    return Ch.pushWrite(this, write)
  }

  consumeRead(result: IteratorResult<T>): void {
    Ch.consumeRead(this, result)
  }

  consumeWrite(): T {
    return Ch.consumeWrite(this)
  }
}

export default Channel
