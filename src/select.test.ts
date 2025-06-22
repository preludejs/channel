import { sleep, spawn } from './test.js'
import Ch from './index.js'

test('simple', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()
  a.writeIgnore(1)
  b.writeIgnore('2')
  const g = Ch.select(a, b)
  const c = await g.next()
  const d = await g.next()
  if (c.value === 1) {
    expect(d.value).toEqual('2')
  } else {
    expect(d.value).toEqual(1)
  }
})

test('select', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()
  const results: string[] = []

  spawn(3, async worker => {
    for await (const value of Ch.select(a, b)) {
      results.push(`${worker} ${value}`)
      if (Math.random() > 0.5) {
        await sleep(Math.round(Math.random() * 10))
      }
    }
  })

  for (let i = 0; i < 100; i++) {
    if (Math.random() > 0.5) {
      a.writeIgnore(i)
    } else {
      b.writeIgnore(i.toString())
    }
  }

  await sleep(2 * 1000)

  expect(results.length).toEqual(100)
})

test('selectNext with immediate values', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()

  // Write values immediately
  a.writeIgnore(42)
  b.writeIgnore('hello')

  const result1 = await Ch.selectNext(a, b)
  const result2 = await Ch.selectNext(a, b)

  expect(result1.done).toBeUndefined()
  expect(result2.done).toBeUndefined()

  const values = [result1.value, result2.value]
  expect(values).toContain(42)
  expect(values).toContain('hello')
})

test('selectNext with closed channels', async () => {
  const a = new Ch<number>(1) // Use buffered channels
  const b = new Ch<string>(1)

  a.writeIgnore(1)
  b.writeIgnore('hello')
  a.closeWriting()
  b.closeWriting()

  // Should get both available values from buffers
  const result1 = await Ch.selectNext(a, b)
  const result2 = await Ch.selectNext(a, b)

  expect(result1.done).toBeUndefined()
  expect(result2.done).toBeUndefined()

  const values = [result1.value, result2.value]
  expect(values).toContain(1)
  expect(values).toContain('hello')

  // After consuming all values, should get done
  const result3 = await Ch.selectNext(a, b)
  expect(result3.done).toBe(true)
})

test('maybeSelect with buffered channels', async () => {
  const a = new Ch<number>(2)
  const b = new Ch<string>(2)

  // Fill buffers
  a.writeIgnore(1)
  a.writeIgnore(2)
  b.writeIgnore('a')

  const result1 = Ch.maybeSelect([a, b])
  const result2 = Ch.maybeSelect([a, b])
  const result3 = Ch.maybeSelect([a, b])
  const result4 = Ch.maybeSelect([a, b])

  expect(result1).toBeDefined()
  expect(result2).toBeDefined()
  expect(result3).toBeDefined()
  expect(result4).toBeUndefined() // No more pending writes

  const values = [result1!.value, result2!.value, result3!.value]
  expect(values).toContain(1)
  expect(values).toContain(2)
  expect(values).toContain('a')
})

test('select with ReadAttempts', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()

  const readA = a.readAttempt(result =>
    result.done ? { done: true, value: undefined } : { value: `number: ${result.value}` }
  )
  const readB = b.readAttempt(result =>
    result.done ? { done: true, value: undefined } : { value: `string: ${result.value}` }
  )

  a.writeIgnore(42)
  b.writeIgnore('hello')

  const result1 = await Ch.selectNext(readA, readB)
  const result2 = await Ch.selectNext(readA, readB)

  expect(result1.done).toBeUndefined()
  expect(result2.done).toBeUndefined()

  const values = [result1.value, result2.value]
  expect(values).toContain('number: 42')
  expect(values).toContain('string: hello')
})

test('select with WriteAttempts', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()

  const writeA = a.writeAttempt(100, value => ({ value: `wrote number: ${value}` }))
  const writeB = b.writeAttempt('test', value => ({ value: `wrote string: ${value}` }))

  // Start readers
  const readPromiseA = a.read()
  const readPromiseB = b.read()

  const result1 = await Ch.selectNext(writeA, writeB)
  const result2 = await Ch.selectNext(writeA, writeB)

  expect(result1.done).toBeUndefined()
  expect(result2.done).toBeUndefined()

  const values = [result1.value, result2.value]
  expect(values).toContain('wrote number: 100')
  expect(values).toContain('wrote string: test')

  // Verify the values were actually written
  expect(await readPromiseA).toBe(100)
  expect(await readPromiseB).toBe('test')
})

test('select with WriteAttempts on buffered channels', async () => {
  const a = new Ch<number>(1) // Buffered channel

  const writeAttempt = a.writeAttempt(42, value => ({ value: `buffered: ${value}` }))

  const result = Ch.maybeSelect([writeAttempt])
  expect(result).toBeDefined()
  expect(result!.value).toBe('buffered: 42')

  // Value should be in buffer
  expect(await a.read()).toBe(42)
})

test('select with mixed attempts', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>(1)

  // Pre-fill buffered channel
  b.writeIgnore('existing')

  const readA = a.readAttempt(result => (result.done ? { done: true, value: undefined } : { value: result.value * 2 }))
  const writeB = b.writeAttempt('new', value => ({ value: `added: ${value}` }))

  // Should select from buffered channel first
  const result1 = Ch.maybeSelect([readA, b, writeB])
  expect(result1).toBeDefined()
  expect(result1!.value).toBe('existing')

  // Now try write attempt
  const result2 = Ch.maybeSelect([readA, writeB])
  expect(result2).toBeDefined()
  expect(result2!.value).toBe('added: new')
})

test('select with empty channels becomes async', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()

  // No immediate values available
  const syncResult = Ch.maybeSelect([a, b])
  expect(syncResult).toBeUndefined()

  // Set up async select
  const selectPromise = Ch.selectNext(a, b)

  // Write value after a delay
  setTimeout(() => a.writeIgnore(99), 10)

  const result = await selectPromise
  expect(result.done).toBeUndefined()
  expect(result.value).toBe(99)
})

test('select generator with early termination', async () => {
  const a = new Ch<number>(2) // Use buffered channels
  const b = new Ch<string>(1)

  // Write values and close
  a.writeIgnore(1)
  b.writeIgnore('first')
  a.writeIgnore(2)
  a.closeWriting()
  b.closeWriting()

  // Collect all values using for-await-of loop
  const values: (number | string)[] = []
  for await (const value of Ch.select(a, b)) {
    values.push(value)
  }

  expect(values).toHaveLength(3)
  expect(values).toContain(1)
  expect(values).toContain('first')
  expect(values).toContain(2)
})

test('select with multiple buffered channels', async () => {
  const channels = [new Ch<number>(2), new Ch<number>(2), new Ch<number>(2)]

  // Fill all buffers partially
  channels[0].writeIgnore(10)
  channels[0].writeIgnore(11)
  channels[1].writeIgnore(20)
  channels[2].writeIgnore(30)
  channels[2].writeIgnore(31)

  const results: number[] = []

  // Select all available values
  let result = Ch.maybeSelect(channels)
  while (result) {
    results.push(result.value as number)
    result = Ch.maybeSelect(channels)
  }

  expect(results).toHaveLength(5)
  expect(results).toContain(10)
  expect(results).toContain(11)
  expect(results).toContain(20)
  expect(results).toContain(30)
  expect(results).toContain(31)
})

test('selectNext with empty closed channels should resolve immediately', async () => {
  const a = new Ch<number>()
  const b = new Ch<string>()

  // Close both channels without writing anything
  a.closeWriting()
  b.closeWriting()

  // This should return {done: true} immediately
  const result = await Ch.selectNext(a, b)
  expect(result.done).toBe(true)
  expect(result.value).toBeUndefined()
})

test('maybeSelect prioritizes random selection', async () => {
  // Test that maybeSelect randomizes selection when multiple channels have data
  const channels = [new Ch<number>(1), new Ch<number>(1), new Ch<number>(1)]

  // Fill all channels
  channels[0].writeIgnore(0)
  channels[1].writeIgnore(1)
  channels[2].writeIgnore(2)

  const selections: number[] = []

  // Make multiple selections to verify randomization
  for (let i = 0; i < 10; i++) {
    const result = Ch.maybeSelect(channels)
    if (result) {
      selections.push(result.value as number)
      // Refill the selected channel
      channels[result.value as number].writeIgnore(result.value as number)
    }
  }

  // Should have made selections from multiple channels
  expect(selections.length).toBe(10)
  expect(new Set(selections).size).toBeGreaterThan(1) // Should have variety
})

test('select error handling with closed channel writes', async () => {
  const a = new Ch<number>()

  a.closeWriting()

  const writeAttempt = a.writeAttempt(42, value => ({ value }))

  // Should not be able to select closed channel write synchronously
  const syncResult = Ch.maybeSelect([writeAttempt])
  expect(syncResult).toBeUndefined()

  // Test that regular write to closed channel throws
  await expect(a.write(42)).rejects.toThrow('Channel closed.')
})
