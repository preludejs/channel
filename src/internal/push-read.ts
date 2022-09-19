import { removeRead } from './remove-read.js'
import type { Channel, Read, Undo } from '../prelude.js'

/**
 * Pushes read to the channel.
 * @returns undo operation.
 * @internal
 */
export const pushRead =
  <T>(ch: Channel<T>, read: Read<T>): Undo => {
    ch.reads.push(read)
    return () => {
      removeRead(ch, read)
    }
  }
