import * as Ch from './index.js'

describe('maybeSelect', () => {
  test('should return result immediately when data is available', () => {
    const ch1 = Ch.of<number>(1)
    const ch2 = Ch.of<string>(1)

    ch1.writeIgnore(42)
    ch2.writeIgnore('hello')

    const result = Ch.maybeSelect([ch1, ch2])
    expect(result).toBeDefined()
    expect(result?.done).toBeUndefined()
    expect([42, 'hello']).toContain(result?.value)
  })

  test('should return undefined when no data is available (default case)', () => {
    const ch1 = Ch.of<number>()
    const ch2 = Ch.of<string>()

    const result = Ch.maybeSelect([ch1, ch2])
    expect(result).toBeUndefined()
  })

  test('should work with WriteAttempts on buffered channels', () => {
    const ch = Ch.of<number>(1)

    const writeAttempt = ch.writeAttempt(99, value => ({
      value: `wrote: ${value}`
    }))

    const result = Ch.maybeSelect([writeAttempt])
    expect(result).toBeDefined()
    expect(result?.value).toBe('wrote: 99')
    expect(result?.done).toBeUndefined()
  })

  test('should work with ReadAttempts', () => {
    const ch = Ch.of<string>()
    ch.writeIgnore('test data')

    const readAttempt = ch.readAttempt(result => ({
      value: result.done ? 'closed' : `read: ${result.value}`
    }))

    const result = Ch.maybeSelect([readAttempt])
    expect(result).toBeDefined()
    expect(result?.value).toBe('read: test data')
    expect(result?.done).toBeUndefined()
  })

  test('should return undefined for WriteAttempts on full unbuffered channels', () => {
    const ch = Ch.of<number>() // unbuffered

    const writeAttempt = ch.writeAttempt(42, value => ({ value }))

    const result = Ch.maybeSelect([writeAttempt])
    expect(result).toBeUndefined()
  })

  test('should handle mixed attempts correctly', () => {
    const ch1 = Ch.of<number>(1)
    const ch2 = Ch.of<string>()

    // Pre-fill buffered channel
    ch1.writeIgnore(123)

    const readAttempt = ch1.readAttempt(result =>
      result.done ? { done: true, value: undefined } : { value: result.value * 2 }
    )
    const writeAttempt = ch2.writeAttempt('hello', value => ({ value: value.toUpperCase() }))

    // Should select from the channel with available data
    const result = Ch.maybeSelect([readAttempt, writeAttempt])
    expect(result).toBeDefined()
    expect(result?.value).toBe(246) // 123 * 2
  })

  test('should consume multiple values from buffered channels', () => {
    const ch = Ch.of<number>(3)

    ch.writeIgnore(1)
    ch.writeIgnore(2)
    ch.writeIgnore(3)

    const results: number[] = []
    let result = Ch.maybeSelect([ch])

    while (result) {
      results.push(result.value as number)
      result = Ch.maybeSelect([ch])
    }

    expect(results).toEqual([1, 2, 3])

    // Should return undefined when buffer is empty
    const emptyResult = Ch.maybeSelect([ch])
    expect(emptyResult).toBeUndefined()
  })

  test('should randomize selection when multiple channels have data', () => {
    const channels = [Ch.of<number>(1), Ch.of<number>(1), Ch.of<number>(1)]

    // Fill all channels with different values
    channels[0].writeIgnore(0)
    channels[1].writeIgnore(1)
    channels[2].writeIgnore(2)

    const selections: number[] = []

    // Make multiple selections to verify some randomization
    for (let i = 0; i < 30; i++) {
      const result = Ch.maybeSelect(channels)
      if (result) {
        selections.push(result.value as number)
        // Refill the selected channel
        channels[result.value as number].writeIgnore(result.value as number)
      }
    }

    expect(selections.length).toBe(30)
    // Should have selected from multiple channels (not always the same one)
    const uniqueSelections = new Set(selections)
    expect(uniqueSelections.size).toBeGreaterThan(1)
  })

  test('should work with closed channels that have buffered data', () => {
    const ch = Ch.of<string>(2)

    ch.writeIgnore('first')
    ch.writeIgnore('second')
    ch.closeWriting() // Close but data still in buffer

    const result1 = Ch.maybeSelect([ch])
    const result2 = Ch.maybeSelect([ch])
    const result3 = Ch.maybeSelect([ch])

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
    expect(result3).toBeUndefined() // No more data

    const values = [result1?.value, result2?.value]
    expect(values).toContain('first')
    expect(values).toContain('second')
  })

  test('should handle empty array of attempts', () => {
    const result = Ch.maybeSelect([])
    expect(result).toBeUndefined()
  })

  test('should be equivalent to Go select with default case', () => {
    // This test demonstrates the Go equivalence
    const ch1 = Ch.of<number>()
    const ch2 = Ch.of<string>(1)

    // Fill one channel
    ch2.writeIgnore('available')

    // Go equivalent:
    // select {
    // case v1 := <-ch1:
    //     // handle v1
    // case v2 := <-ch2:
    //     // handle v2
    // default:
    //     // no channels ready
    // }

    const result = Ch.maybeSelect([ch1, ch2])
    expect(result).toBeDefined() // ch2 has data
    expect(result?.value).toBe('available')

    // Now both channels are empty
    const defaultResult = Ch.maybeSelect([ch1, ch2])
    expect(defaultResult).toBeUndefined() // Go's default case
  })
})
