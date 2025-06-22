import Ch from './index.js'
import { afterRandom } from './test.js'

test('write, read on semaphore', async () => {
  const ch = new Ch<number>()
  ch.writeIgnore(3)
  await expect(ch.read()).resolves.toEqual(3)
})

test('two delayed writes, two reads', async () => {
  const ch = new Ch<number>()
  afterRandom(100, () => ch.write(3))
  afterRandom(100, () => ch.write(5))
  const a = await ch.read()
  const b = await ch.read()
  expect(a + b).toEqual(8)
})

test('tryWrite should return true when write succeeds', async () => {
  const ch = new Ch<number>()

  // Start a reader
  const readPromise = ch.read()

  // maybeWrite should succeed
  const result = await ch.maybeWrite(42)
  expect(result).toBe(true)

  // Verify the value was written
  expect(await readPromise).toBe(42)
})

test('tryWrite should return false when channel is closed', async () => {
  const ch = new Ch<number>()

  // Close the channel
  ch.closeWriting()

  // tryWrite should fail gracefully
  const result = await ch.maybeWrite(42)
  expect(result).toBe(false)
})

test('tryWrite should succeed with buffered channels', async () => {
  const ch = new Ch<number>(2)

  // Should succeed up to buffer capacity
  await expect(ch.maybeWrite(1)).resolves.toBe(true)
  await expect(ch.maybeWrite(2)).resolves.toBe(true)

  // Verify values are in buffer
  expect(await ch.read()).toBe(1)
  expect(await ch.read()).toBe(2)
})
