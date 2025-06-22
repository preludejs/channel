import type { Undo, Done, Read, Write } from './channel.js'
import * as Ch from './channel.js'

export class Class<T> implements AsyncIterableIterator<T> {
  readonly type = 'Channel'
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

  static of<T>(cap = 0) {
    return new Class<T>(cap)
  }

  static ofIterable<T>(iterable: Iterable<T>, cap = 0) {
    return Ch.ofIterable(iterable, cap, Class.of)
  }

  static ofAsyncIterable<T>(iterable: AsyncIterable<T>, cap = 0) {
    return Ch.ofAsyncIterable(iterable, cap, Class.of)
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
    return Ch.consumeWrites(this)
  }

  readAttempt<R>(perform: (result: IteratorResult<T>) => IteratorResult<R>) {
    return Ch.readAttempt<T, R>(this, perform)
  }

  write(value: T) {
    return Ch.write(this, value)
  }

  /**
   * Attempts to write a value to the channel without throwing.
   * @returns `true` if write succeeded, `false` otherwise (ie. if channel is closed).
   */
  maybeWrite(value: T): Promise<boolean> {
    return Ch.maybeWrite(this, value)
  }

  /** Attempts to write a value to the channel ignoring result. */
  writeIgnore(value: T): void {
    Ch.writeIgnore(this, value)
  }

  writeAttempt<R>(value: T, perform: (value: T) => IteratorResult<R>) {
    return Ch.writeAttempt<T, R>(this, value, perform)
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

  static async *select<Attempts extends Ch.Attempt[]>(
    ...attempts: Attempts
  ): AsyncGenerator<Ch.Attempted<Attempts[number]>> {
    yield* Ch.select(...attempts)
  }

  static async selectNext<Attempts extends Ch.Attempt[]>(
    ...attempts: Attempts
  ): Promise<IteratorResult<Ch.Attempted<Attempts[number]>>> {
    return Ch.selectNext(...attempts)
  }

  static maybeSelect<Attempts extends Ch.Attempt[]>(
    attempts: Attempts
  ): undefined | IteratorResult<Ch.Attempted<Attempts[number]>> {
    return Ch.maybeSelect(attempts)
  }
}

export default Class
