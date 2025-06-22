import { Class } from './class.js'

/** @returns channel that closes after specified time in milliseconds. */
export function after<T = unknown>(milliseconds: number) {
  const ch = new Class<T>()
  const timeoutId = setTimeout(() => ch.closeWriting(), milliseconds)
  ch.onceDoneWriting(() => clearTimeout(timeoutId))
  return ch
}
