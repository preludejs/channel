import { consumeWrite } from './internal/consume-write.js'
import { pushRead } from './internal/push-read.js'
import { pushWrite } from './internal/push-write.js'
import { randomIndex } from './internal/random-index.js'
import type { Attempt, Attempted, Thunk } from './prelude.js'
import { consumeRead } from './internal/consume-read.js'

export const selectSync =
  <Ts extends Attempt[]>(attempts: Ts): undefined | IteratorResult<Attempted<Ts[number]>> => {
    const n = attempts.length
    for (let i = 0; i < n; i++) {
      const j = i + randomIndex(n - i)
      const attempt = attempts[j]
      switch (attempt.type) {
        case 'channel':
          if (attempt.writes.length > 0) {
            return { value: consumeWrite<Attempted<Ts[number]>>(attempt) }
          }
          break
        case 'read':
          if (attempt.ch.writes.length > 0) {
            const value = consumeWrite<Attempted<Ts[number]>>(attempt.ch)
            return attempt.cb({ value })
          }
          break
        case 'write':
          if (attempt.ch.cap === 0 && attempt.ch.reads.length > 0) {
            consumeRead(attempt.ch, attempt.value)
            return attempt.cb() as IteratorResult<Attempted<Ts[number]>>
          } else if (attempt.ch.writes.length < attempt.ch.cap) {
            attempt.ch.writes.push({ value: attempt.value })
            return attempt.cb() as IteratorResult<Attempted<Ts[number]>>
          }
          break
        default:
          throw new Error(`Unsupported case ${JSON.stringify(attempt)}.`)
      }
      attempts[j] = attempts[i]
      attempts[i] = attempt
    }
    return
  }

export const selectAsync =
  <Ts extends Attempt[]>(attempts: Ts): Promise<IteratorResult<Attempted<Ts[number]>>> =>
    new Promise((resolve, reject) => {
      const undos: Thunk[] = []
      for (const attempt of attempts) {
        switch (attempt.type) {
          case 'channel':
            undos.push(pushRead(attempt, (result: IteratorResult<Attempted<Ts[number]>>) => {
              undos.forEach(undo => undo())
              resolve(result)
            }))
            break
          case 'read':
            undos.push(pushRead(attempt.ch, (result: IteratorResult<Attempted<Ts[number]>>) => {
              undos.forEach(undo => undo())
              resolve(attempt.cb(result))
            }))
            break
          case 'write':
            undos.push(pushWrite(attempt.ch, { value: attempt.value, enqueued: (err: unknown) => {
              undos.forEach(_ => _())
              if (err) {
                reject(err)
                return
              }
              resolve(attempt.cb() as IteratorResult<Attempted<Ts[number]>>)
            }}))
            break
          default:
            throw new Error(`Unsupported case ${JSON.stringify(attempt)}.`)
        }
      }
    })

export const select =
  async function* <Ts extends Attempt[]>(...attempts: Ts): AsyncGenerator<Attempted<Ts[number]>> {
    while (true) {
      const result = selectSync(attempts) ?? await selectAsync(attempts)
      if (result.done) {
        break
      }
      yield result.value
    }
  }
