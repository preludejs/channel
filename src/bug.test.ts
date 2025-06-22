import Ch from './index.js'

test('maybeRead should return value when available, undefined when done', async () => {
  const ch = new Ch<number>(1) // Use buffered channel

  // Write a value and close
  ch.writeIgnore(42)
  ch.closeWriting()

  // First read should return the value
  const result1 = await ch.maybeRead()
  expect(result1).toBe(42)

  // Second read should return undefined (channel is done)
  const result2 = await ch.maybeRead()
  expect(result2).toBe(undefined)
})

test('maybeRead should return undefined when channel is done', async () => {
  const ch = new Ch<number>()

  // Close channel without writing anything
  ch.closeWriting()

  const result = await ch.maybeRead()
  expect(result).toBe(undefined)
})

test('maybeRead should return values when available', async () => {
  const ch = new Ch<number>(3) // Buffered channel with capacity 3

  // Write multiple values
  ch.writeIgnore(1)
  ch.writeIgnore(2)
  ch.writeIgnore(3)
  ch.closeWriting()

  const result1 = await ch.maybeRead()
  const result2 = await ch.maybeRead()
  const result3 = await ch.maybeRead()
  const result4 = await ch.maybeRead()

  expect(result1).toBe(1)
  expect(result2).toBe(2)
  expect(result3).toBe(3)
  expect(result4).toBe(undefined)
})

test('closeWriting should be idempotent - not throw when called twice', async () => {
  const ch = new Ch<number>()

  // First close should work
  ch.closeWriting()

  // Second close should not throw
  expect(() => ch.closeWriting()).not.toThrow()

  // Third close should also not throw
  expect(() => ch.closeWriting()).not.toThrow()
})
