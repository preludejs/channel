import * as Ch from './index.js'

describe('Async Iteration', () => {
  describe('Default JS Semantics', () => {
    test('breaking out of for-await loop should close the channel (JS semantics)', async () => {
      const ch = Ch.of<number>()

      // Write some values
      ch.writeIgnore(1)
      ch.writeIgnore(2)
      ch.writeIgnore(3)

      // Break out of loop after first value
      const values: number[] = []
      for await (const value of ch) {
        values.push(value)
        if (value === 1) {
          break
        }
      }

      expect(values).toEqual([1])

      // Channel should be closed (JS semantics)
      expect(ch.doneWriting).toBe(true)
      expect(ch.done).toBe(true)
    })

    test('iterator return should close channel (JS semantics)', async () => {
      const ch = Ch.of<number>()

      ch.writeIgnore(1)
      ch.writeIgnore(2)

      const iterator = ch[Symbol.asyncIterator]()

      // Read first value
      const result1 = await iterator.next()
      expect(result1.value).toBe(1)
      expect(result1.done).toBeUndefined()

      // Call return() to terminate iterator
      const returnResult = await iterator.return()
      expect(returnResult.done).toBe(true)

      // Channel should be closed (JS semantics)
      expect(ch.doneWriting).toBe(true)
      expect(ch.done).toBe(true)
    })
  })

  describe('Go Semantics via .range', () => {
    test('breaking out of range iteration should not close the channel', async () => {
      const ch = Ch.of<number>()

      // Write some values
      ch.writeIgnore(1)
      ch.writeIgnore(2)
      ch.writeIgnore(3)

      // Break out of loop after first value using .range
      const values: number[] = []
      for await (const value of ch.range) {
        values.push(value)
        if (value === 1) {
          break
        }
      }

      expect(values).toEqual([1])

      // Channel should still be open and readable (Go semantics)
      expect(ch.doneWriting).toBe(false)
      expect(ch.done).toBe(false)

      // Should be able to read remaining values
      expect(await ch.read()).toBe(2)
      expect(await ch.read()).toBe(3)
    })

    test('range iterator return should not close channel', async () => {
      const ch = Ch.of<number>()

      ch.writeIgnore(1)
      ch.writeIgnore(2)

      const iterator = ch.range[Symbol.asyncIterator]()

      // Read first value
      const result1 = await iterator.next()
      expect(result1.value).toBe(1)
      expect(result1.done).toBeUndefined()

      // Call return() to terminate iterator
      const returnResult = await iterator.return?.()
      expect(returnResult?.done).toBe(true)

      // Channel should still be open (Go semantics)
      expect(ch.doneWriting).toBe(false)
      expect(ch.done).toBe(false)

      // Should still be able to read from channel directly
      expect(await ch.read()).toBe(2)
    })

    test('range iterator throw should not close channel', async () => {
      const ch = Ch.of<number>()

      ch.writeIgnore(1)
      ch.writeIgnore(2)

      const iterator = ch.range[Symbol.asyncIterator]()

      // Read first value
      const result1 = await iterator.next()
      expect(result1.value).toBe(1)
      expect(result1.done).toBeUndefined()

      // Call throw() to terminate iterator
      const throwResult = await iterator.throw?.(new Error('test error'))
      expect(throwResult?.done).toBe(true)

      // Channel should still be open (Go semantics)
      expect(ch.doneWriting).toBe(false)
      expect(ch.done).toBe(false)

      // Should still be able to read from channel directly
      expect(await ch.read()).toBe(2)
    })
  })

  describe('Common Behavior', () => {
    test('normal iteration until channel is closed', async () => {
      const ch = Ch.of<number>()

      // Write values with delay to allow iteration to start
      setTimeout(() => ch.writeIgnore(1), 10)
      setTimeout(() => ch.writeIgnore(2), 20)
      setTimeout(() => {
        ch.writeIgnore(3)
        ch.closeWriting()
      }, 30)

      const values: number[] = []
      for await (const value of ch.range) {
        values.push(value)
      }

      expect(values).toEqual([1, 2, 3])
      expect(ch.doneWriting).toBe(true)
      expect(ch.done).toBe(true)
    })

    test('iteration with buffered channel', async () => {
      const ch = Ch.of<number>(3)

      // Fill buffer
      ch.writeIgnore(1)
      ch.writeIgnore(2)
      ch.writeIgnore(3)
      ch.closeWriting()

      const values: number[] = []
      for await (const value of ch.range) {
        values.push(value)
      }

      expect(values).toEqual([1, 2, 3])
      expect(ch.done).toBe(true)
    })

    test('early break with buffered channel and range should not close channel', async () => {
      const ch = Ch.of<number>(3)

      // Fill buffer
      ch.writeIgnore(1)
      ch.writeIgnore(2)
      ch.writeIgnore(3)

      const values: number[] = []
      for await (const value of ch.range) {
        values.push(value)
        if (value === 2) {
          break
        }
      }

      expect(values).toEqual([1, 2])
      expect(ch.doneWriting).toBe(false)
      expect(ch.done).toBe(false)

      // Should still be able to read remaining value
      expect(await ch.read()).toBe(3)
    })

    test('multiple range iterators on same channel', async () => {
      const ch = Ch.of<number>()

      ch.writeIgnore(1)
      ch.writeIgnore(2)
      ch.writeIgnore(3)

      const iterator1 = ch.range[Symbol.asyncIterator]()
      const iterator2 = ch.range[Symbol.asyncIterator]()

      // Both iterators should be able to read (though they'll compete for values)
      const result1 = await iterator1.next()
      const result2 = await iterator2.next()

      expect(result1.done).toBeUndefined()
      expect(result2.done).toBeUndefined()

      // Values should be different (consumed by different iterators)
      expect(result1.value).not.toBe(result2.value)

      // Terminating one iterator shouldn't affect the channel or other iterator (Go semantics)
      await iterator1.return?.()

      expect(ch.doneWriting).toBe(false)
      expect(ch.done).toBe(false)

      // Other iterator should still work
      const result3 = await iterator2.next()
      expect(result3.done).toBeUndefined()
    })
  })
})
