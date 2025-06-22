import * as Ch from './index.js'

describe('Bug Fixes', () => {
  test('Bug #1: maybeRead should return correct values', async () => {
    // Test with buffered channel
    const ch = Ch.of<number>(2)

    // Write values and close
    ch.writeIgnore(42)
    ch.writeIgnore(100)
    ch.closeWriting()

    // Should return values when available
    const result1 = await ch.maybeRead()
    expect(result1).toBe(42)

    const result2 = await ch.maybeRead()
    expect(result2).toBe(100)

    // Should return undefined when channel is done
    const result3 = await ch.maybeRead()
    expect(result3).toBe(undefined)
  })

  test('Bug #2: closeWriting should be idempotent', async () => {
    const ch = Ch.of<number>()
    expect(ch.doneWriting).toBe(false)

    // First close should work
    ch.closeWriting()
    expect(ch.doneWriting).toBe(true)

    // Second close should not throw
    expect(() => ch.closeWriting()).not.toThrow()
    expect(ch.doneWriting).toBe(true)

    // Third close should also not throw
    expect(() => ch.closeWriting()).not.toThrow()
    expect(ch.doneWriting).toBe(true)
  })

  test('Bug #3: removeWrite should handle buffered channels correctly', async () => {
    const ch = Ch.of<number>(1)

    // This test verifies that the internal removeWrite method
    // properly handles callback invocation for buffered channels
    // The fix ensures that writes that were actually in the buffer
    // have their callbacks called when removed

    const promises: Promise<void>[] = []

    // Add writes to buffer
    promises.push(ch.write(1)) // Should go into buffer immediately
    promises.push(ch.write(2)) // Should wait (beyond capacity)
    promises.push(ch.write(3)) // Should wait (beyond capacity)

    // Close the channel, which will trigger removeWrite logic
    ch.close()

    // All writes are resolved when channel is closed (this is correct behavior)
    await expect(Promise.allSettled(promises)).resolves.toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined }
    ])
  })

  test('Bug #4: maybeSelect should handle WriteAttempt for buffered channels correctly', async () => {
    const ch = Ch.of<number>(2)

    // Create a write attempt
    const writeAttempt = ch.writeAttempt(42, value => ({ value: value * 2 }))

    // maybeSelect should handle this correctly for buffered channels
    const result = Ch.maybeSelect([writeAttempt])

    expect(result).toBeDefined()
    expect(result?.value).toBe(84) // 42 * 2
    expect(result?.done).toBeUndefined()

    // The value should now be in the channel
    const readValue = await ch.read()
    expect(readValue).toBe(42)
  })

  test('All bugs fixed: comprehensive integration test', async () => {
    // Test maybeRead with proper behavior
    const ch1 = Ch.of<string>(1)
    ch1.writeIgnore('hello')
    ch1.closeWriting()

    expect(await ch1.maybeRead()).toBe('hello')
    expect(await ch1.maybeRead()).toBe(undefined)

    // Test idempotent closeWriting
    const ch2 = Ch.of<number>()
    ch2.closeWriting()
    ch2.closeWriting() // Should not throw
    ch2.closeWriting() // Should not throw

    expect(ch2.doneWriting).toBe(true)

    // Test select with buffered channel write attempts
    const ch3 = Ch.of<number>(1)
    const writeAttempt = ch3.writeAttempt(123, value => ({
      value: `wrote ${value}`
    }))

    const selectResult = await Ch.selectNext(writeAttempt)
    expect(selectResult.done).toBeUndefined()
    expect(selectResult.value).toBe('wrote 123')

    // Value should be in channel
    expect(await ch3.read()).toBe(123)
  })
})
