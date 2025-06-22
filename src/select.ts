import { Channel, ReadAttempt, WriteAttempt, Attempt, Attempted } from './class.js'
import { Thunk } from './channel.js'

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
        if (attempt instanceof Channel) {
          undos.push(
            attempt.pushRead(result => {
              safeResolve(result as IteratorResult<Attempted<Attempts[number]>>)
            })
          )
        } else if (attempt instanceof WriteAttempt) {
          undos.push(
            attempt.channel.pushWrite({
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
        } else if (attempt instanceof ReadAttempt) {
          undos.push(
            attempt.channel.pushRead(result => {
              safeResolve(attempt.perform(result) as IteratorResult<Attempted<Attempts[number]>>)
            })
          )
        } else {
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
    shuffled[j] = shuffled[i]
    shuffled[i] = attempt
  }
  return
}
