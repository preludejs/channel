/** Represents zero-arity function with arbitrary return type. */
export type Thunk<R = void> =
  () =>
    R

/** Represents read attempt. */
export type Read<T> =
  (result: IteratorResult<T>) =>
    void

/** Represents write attempt. */
export type Write<T> = {

  /** Value to be written. */
  value: T,

  /** Called when write has been enqueued. */
  enqueued?: (err: unknown) => void

  /** Called when write has been read. */
  consumed?: (err: unknown) => void

}

/** Represents channel. */
export type Channel<T> = AsyncIterableIterator<T> & {
  readonly type: 'channel',
  readonly reads: Read<T>[],
  readonly writes: Write<T>[],
  readonly cap: number,
  done: boolean
}

/** @see {@link Channel} */
export type t<T> =
  Channel<T>

/** Represents read attempt as select case. */
export type ReadAttempt<T, R> = {
  type: 'read',
  ch: Channel<T>,
  cb: (result: IteratorResult<T>) => IteratorResult<R>
}

/** Represents write attempt as select case. */
export type WriteAttempt<T, R> = {
  type: 'write',
  ch: Channel<T>,
  value: T,
  cb: () => IteratorResult<R>
}

/** Represents select case attempt. */
export type Attempt<T = any, R = any> =
  | Channel<T>
  | ReadAttempt<T, R>
  | WriteAttempt<T, R>

/** Infers type of attempted. */
export type Attempted<T extends Attempt> =
  T extends Channel<infer U> ?
    U :
    T extends ReadAttempt<any, infer U> ?
      U :
      T extends WriteAttempt<any, infer U> ?
        U :
        never

/** Represents undo operation. */
export type Undo =
  Thunk

export class ChannelClosedError extends Error {
  constructor(message = 'Channel closed.') {
    super(message)
  }
}
