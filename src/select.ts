import { Channel, ReadAttempt, WriteAttempt, Attempt, Attempted, Thunk } from './channel.js'

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
  return selectSync(attempts) ?? await selectAsync(attempts)
}

export function selectAsync<Attempts extends Attempt[]>(
  attempts: Attempts
): Promise<IteratorResult<Attempted<Attempts[number]>>> {
  return new Promise((resolve, reject) => {
    const undos: Thunk[] = []
    for (const attempt of attempts) {
      if (attempt instanceof Channel) {
        undos.push(attempt.pushRead(result => {
          undos.forEach(undo => undo())
          resolve(result as IteratorResult<Attempted<Attempts[number]>>)
        }))
      } else if (attempt instanceof WriteAttempt) {
        undos.push(attempt.channel.pushWrite({ value: attempt.value, enqueued: (err: unknown) => {
          undos.forEach(_ => _())
          if (err) {
            reject(err)
            return
          }
          resolve(attempt.perform(attempt.value) as IteratorResult<Attempted<Attempts[number]>>)
        }}))
      } else if (attempt instanceof ReadAttempt) {
        undos.push(attempt.channel.pushRead(result => {
          undos.forEach(undo => undo())
          resolve(attempt.perform(result) as IteratorResult<Attempted<Attempts[number]>>)
        }))
      } else {
        throw new Error('Invalid attempt.')
      }
    }
  })
}

export function selectSync<Attempts extends Attempt[]>(
  attempts: Attempts
): undefined | IteratorResult<Attempted<Attempts[number]>> {
  const n = attempts.length
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (n - i))
    const attempt = attempts[j] as Attempts[number]
    if (attempt instanceof Channel) {
      if (attempt.pendingWrites > 0) {
        return { value: attempt.consumeWrite() }
      }
    } else if (attempt instanceof WriteAttempt) {
      if (attempt.channel.cap === 0 && attempt.channel.pendingReads > 0) {
        attempt.channel.consumeRead({ value: attempt.value })
        return attempt.perform(attempt.value)
      } else if (attempt.channel.pendingWrites < attempt.channel.cap) {
        attempt.channel.pushWrite({ value: attempt.value })
        return attempt.perform(attempt.value)
      }
    } else if (attempt instanceof ReadAttempt) {
      if (attempt.channel.pendingWrites > 0) {
        const value = attempt.channel.consumeWrite()
        return attempt.perform({ value })
      }
    } else {
      throw new Error('Invalid attempt.')
    }
    attempts[j] = attempts[i]
    attempts[i] = attempt
  }
  return
}
