import { Channel } from './channel.js'

export function of<T>(cap = 0) {
  return new Channel<T>(cap)
}

export function ofIterable<T>(iterable: Iterable<T>, cap = 0) {
  const ch = new Channel<T>(cap)
  const produce =
    async () => {
      for (const value of iterable) {
        if (ch.doneWriting) {
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

export function ofAsyncIterable<T>(asyncIterable: AsyncIterable<T>) {
  const ch = new Channel<T>()
  const produce =
    async () => {
      for await (const value of asyncIterable) {
        if (ch.doneWriting) {
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
