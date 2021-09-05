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
