
export interface Thunk {
  (): void
}

export interface Undo {
  (): void
}

export class AttemptBase {
}

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

export type Attempt =
  | Channel<any>
  | ReadAttempt<any, any>
  | WriteAttempt<any, any>

export type Attempted<A extends Attempt> =
  A extends Channel<infer T> ?
    T :
    A extends ReadAttempt<any, infer R> ?
      R :
      A extends WriteAttempt<any, infer R> ?
        R :
        never

export interface Done {
  (err?: unknown): void
}

export interface Read<T> {
  (result: IteratorResult<T>): void
}

export interface Write<T> {
  value: T
  enqueued?: Done
  written?: Done
}

export default class Channel<T> implements AsyncIterableIterator<T> {

  #cap: number
  #closed: boolean
  #reads: Read<T>[]
  #writes: Write<T>[]

  constructor(cap = 0) {
    this.#cap = cap
    this.#closed = false
    this.#reads = []
    this.#writes = []
  }

  /** @returns channel from provided async iterable with specified capacity. */
  static ofAsyncIterable<T>(values: AsyncIterable<T>, cap = 0) {
    const ch = new Channel<T>(cap)
    const produce =
      async () => {
        for await (const value of values) {
          if (ch.done) {
            break
          }
          await ch.write(value)
        }
      }
    produce()
      .finally(() => {
        ch.closeWriting()
      })
    return ch
  }

  /** @returns channel from provided iterable with specified capacity. */
  static ofIterable<T>(values: Iterable<T>, cap = 0) {
    const ch = new Channel<T>(cap)
    const produce =
      async () => {
        for (const value of values) {
          if (ch.done) {
            break
          }
          await Promise
            .resolve()
            .then(() => ch.write(value))
        }
      }
    produce()
      .finally(() => {
        ch.closeWriting()
      })
    return ch
  }

  /** @returns channel that closes after specified time in milliseconds. */
  static after(milliseconds: number) {
    const ch = new Channel<undefined>()
    const timeoutId = setTimeout(() => ch.closeWriting(), milliseconds)
    ch.next().then(() => {
      clearTimeout(timeoutId)
    })
    return ch
  }

  [Symbol.asyncIterator]() {
    return this
  }

  async return(value?: any) {
    this.close()
    return { done: true, value }
  }

  async throw(err?: any) {
    this.close(err)
    return { done: true, value: err }
  }

  /** @returns `true` if channels has been closed and there are no pending writes. */
  get done() {
    return this.#closed && this.#writes.length === 0
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
    if (this.#closed) {
      return
    }
    this.#closed = true
    while (this.#writes.length > this.#cap) {
      const write = this.#writes.pop() as Write<T>
      write.enqueued?.call(this, err)
      write.written?.call(this, err)
    }
  }

  /**
   * Closes channel for both reading and writing.
   *
   * @see {@link closeWriting} for closing channel for writing only.
   */
  close(err?: unknown) {
    this.closeWriting(err)
    while (true) {
      const write = this.#writes.pop()
      if (!write) {
        break
      }
      write.enqueued?.call(this, err)
      write.written?.call(this, err)
    }
    while (true) {
      const read = this.#reads.pop()
      if (!read) {
        break
      }
      read?.call(this, { done: true, value: undefined })
    }
  }

  next(): Promise<IteratorResult<T>> {
    return new Promise(resolve => {
      if (this.done) {
        resolve({ done: true, value: undefined })
        return
      }
      this.#reads.push(resolve)
      if (this.#writes.length > 0) {
        this.#consume()
      }
    })
  }

  /** @throws if channel is closed. */
  async read(): Promise<T> {
    const result = await this.next()
    if (result.done) {
      throw new Error('Channel closed.')
    }
    return result.value
  }

  async maybeRead(): Promise<undefined | T> {
    const result = await this.next()
    return result.done ?
      result.value :
      undefined
  }

  /** @returns all values that was possible to read immediatelly, aka all pending writes. */
  readAllSync(): T[] {
    const values: T[] = []
    while (this.#writes.length > 0) {
      values.push(this.#consumeWrite())
    }
    return values
  }

  readAttempt<R>(perform: (result: IteratorResult<T>) => IteratorResult<R>) {
    return new ReadAttempt(this, perform)
  }

  write(value: T) {
    return new Promise<void>((resolve, reject) => {
      if (this.done) {
        reject(new Error('Channel closed.'))
        return
      }
      if (this.#cap === 0 && this.#reads.length > 0) {
        this.#consumeRead({ value })
        resolve(undefined)
        return
      } else if (this.#writes.length < this.#cap) {
        this.#writes.push({ value })
        resolve(undefined)
        if (this.#reads.length > 0) {
          this.#consume()
        }
        return
      }
      this.#writes.push({
        value,
        enqueued(err: unknown) {
          if (err) {
            reject(err)
          } else {
            resolve(undefined)
          }
        }
       })
    })
  }

  maybeWrite(value: T) {
    return this
      .write(value)
      .then(() => true)
      .catch(() => false)
  }

  writeIgnore(value: T) {
    this.write(value).catch(() => {})
  }

  writeAttempt<R>(value: T, perform: (value: T) => IteratorResult<R>) {
    return new WriteAttempt(this, value, perform)
  }

  static async selectNext<Attempts extends Attempt[]>(
    ...attempts: Attempts
  ): Promise<IteratorResult<Attempted<Attempts[number]>>> {
    return this.#selectSync(attempts) ?? await this.#selectAsync(attempts)
  }

  static async* select<Attempts extends Attempt[]>(
    ...attempts: Attempts
  ): AsyncGenerator<Attempted<Attempts[number]>> {
    while (true) {
      const result = await this.selectNext(...attempts)
      if (result.done) {
        break
      }
      yield result.value
    }
  }

  static #selectSync<Attempts extends Attempt[]>(
    attempts: Attempts
  ): undefined | IteratorResult<Attempted<Attempts[number]>> {
    const n = attempts.length
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (n - i))
      const attempt = attempts[j]
      if (attempt instanceof Channel) {
        if (attempt.#writes.length > 0) {
          return { value: attempt.#consumeWrite() } as IteratorResult<Attempted<Attempts[number]>>
        }
      } else if (attempt instanceof WriteAttempt) {
        if (attempt.channel.#cap === 0 && attempt.channel.#reads.length > 0) {
          attempt.channel.#consumeRead({ value: attempt.value })
          return attempt.perform(attempt.value) as IteratorResult<Attempted<Attempts[number]>>
        } else if (attempt.channel.#writes.length < attempt.channel.#cap) {
          attempt.channel.#writes.push({ value: attempt.value })
          return attempt.perform(attempt.value) as IteratorResult<Attempted<Attempts[number]>>
        }
      } else if (attempt instanceof ReadAttempt) {
        if (attempt.channel.#writes.length > 0) {
          const value = attempt.channel.#consumeWrite()
          return attempt.perform({ value }) as IteratorResult<Attempted<Attempts[number]>>
        }
      } else {
        throw new Error('Invalid attempt.')
      }
      attempts[j] = attempts[i]
      attempts[i] = attempt
    }
    return
  }

  static #selectAsync<Attempts extends Attempt[]>(
    attempts: Attempts
  ): Promise<IteratorResult<Attempted<Attempts[number]>>> {
    return new Promise((resolve, reject) => {
      const undos: Thunk[] = []
      for (const attempt of attempts) {
        if (attempt instanceof Channel) {
          undos.push(attempt.#pushRead(result => {
            undos.forEach(undo => undo())
            resolve(result as IteratorResult<Attempted<Attempts[number]>>)
          }))
        } else if (attempt instanceof WriteAttempt) {
          undos.push(attempt.channel.#pushWrite({ value: attempt.value, enqueued: (err: unknown) => {
            undos.forEach(_ => _())
            if (err) {
              reject(err)
              return
            }
            resolve(attempt.perform(attempt.value) as IteratorResult<Attempted<Attempts[number]>>)
          }}))
        } else if (attempt instanceof ReadAttempt) {
          undos.push(attempt.channel.#pushRead(result => {
            undos.forEach(undo => undo())
            resolve(attempt.perform(result) as IteratorResult<Attempted<Attempts[number]>>)
          }))
        } else {
          throw new Error('Invalid attempt.')
        }
      }
    })
  }

  /**
   * Pushes read to the channel.
   * @returns undo operation.
   * @internal
   */
  #pushRead(read: Read<T>): Undo {
    this.#reads.push(read)
    return () => {
      this.#removeRead(read)
    }
  }

  /**
   * Pushes write to the channel.
   * @returns undo operation.
   * @internal
   */
  #pushWrite(write: Write<T>): Undo {
    this.#writes.push(write)
    return () => {
      this.#removeWrite(write)
    }
  }

  /**
   * Removes read from channel.
   * No-op if not found.
   * @internal
   */
  #removeRead(read: Read<T>) {
    const i = this.#reads.indexOf(read)
    if (i === -1) {
      return
    }
    this.#reads.splice(i, 1)
  }

  /**
   * Removes write from channel.
   * No-op if write is not found.
   * @internal
   */
  #removeWrite(write: Write<T>, err?: unknown) {
    const i = this.#writes.lastIndexOf(write)
    if (i === -1) {
      return
    }

    // TODO: make it optional? what if we want to remove without callbacks in select?
    if (this.#cap === 0) {
      this.#writes[i].enqueued?.call(this, err)
    }
    this.#writes[i].written?.call(this, err)

    this.#writes.splice(i, 1)
  }

  #consumeRead(result: IteratorResult<T>) {
    const read = this.#reads.shift()
    if (!read) {
      throw new Error('No read to consume.')
    }
    read(result)
  }

  #consumeWrite() {
    const write = this.#writes.shift()
    if (!write) {
      throw new Error('no write to consume')
    }
    if (this.#cap === 0) {
      write.enqueued?.call(this)
    } else if (this.#writes.length >= this.#cap) {
      this.#writes[this.#cap - 1].enqueued?.call(this)
    }
    write.written?.call(this)
    return write.value
  }

  #consume() {
    if (this.#reads.length === 0) {
      throw new Error('no reads')
    }
    if (this.#writes.length === 0) {
      throw new Error('no writes')
    }
    const read = this.#reads.shift() as Read<T>
    const write = this.#writes.shift() as Write<T>
    if (this.#cap === 0) {
      write.enqueued?.call(this)
      write.written?.call(this)
    } else if (this.#writes.length >= this.#cap) {
      this.#writes[this.#cap - 1].enqueued?.call(this)
    }
    read.call(this, { value: write.value })
  }

}
