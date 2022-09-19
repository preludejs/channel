import { removeWrite } from './remove-write.js'
import type { Channel, Write, Undo } from '../prelude.js'

/**
 * Pushes write to the channel.
 * @returns undo operation.
 * @internal
 */
export const pushWrite =
  <T>(ch: Channel<T>, write: Write<T>): Undo => {
    ch.writes.push(write)
    return () => {
      removeWrite(ch, write)
    }
  }
