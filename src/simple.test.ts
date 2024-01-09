import * as Ch from './index.js'
import { afterRandom, sleep } from './test.js'
import * as Cmp from '@prelude/cmp'

test('simple', async () => {
  const ch = Ch.of<number>()
  const timeline: unknown[] = []

  ch.write(3).then(() => timeline.push([ 'enqueued', 3 ]))
  ch.write(5).then(() => timeline.push([ 'enqueued', 5 ]))
  ch.write(7).then(() => timeline.push([ 'enqueued', 7 ]))

  let i = 0
  for await (const value of ch) {
    timeline.push([ 'processed', value ])
    if (++i === 3) {
      break
    }
  }

  expect(timeline).toEqual([
    [ 'enqueued', 3 ],
    [ 'processed', 3 ],
    [ 'enqueued', 5 ],
    [ 'processed', 5 ],
    [ 'enqueued', 7 ],
    [ 'processed', 7 ]
  ])
})

test('delayed receive', async () => {

  const delayedNumber =
    (value: number) => {
      const ch = Ch.of<number>()
      setTimeout(() => {
        ch.write(value)
      }, Math.random() * 100)
      return ch
    }

  const a = delayedNumber(3)
  const b = delayedNumber(5)

  expect(await a.read() + await b.read()).toEqual(8)
})

test('two delayed writes, two reads', async () => {
  const a = Ch.of<number>()
  afterRandom(1000, () => a.write(3))
  afterRandom(1000, () => a.write(5))
  expect(await a.read() + await a.read()).toEqual(8)
})

test('async iterable consumer', async () => {
  const ch = Ch.of<number>()
  sleep(100).then(() => ch.write(3))
  sleep(200).then(() => ch.write(5))
  sleep(300).then(() => {
    ch.write(7)
    ch.closeWriting()
  })
  const values: number[] = []
  for await (const value of ch) {
    values.push(value)
  }
  expect(values).toEqual([ 3, 5, 7 ])
})

test('concurrent map', async () => {

  type F<T, U> = (value: T, index: number, worker: number) => U | Promise<U>

  function unordered<T, U>(f: F<T, U>, concurrency: number) {
    return async function* (values: Iterable<T>) {
      let index = 0
      const input = Ch.ofIterable(values)
      const output = Ch.of<U>()
      Promise
        .allSettled(Array.from({ length: concurrency }, async (_, worker) => {
          for await (const value of input) {
            await output.write(await Promise.resolve(f(value, index++, worker)))
          }
        }))
        .finally(() => {
          output.closeWriting()
        })
      yield* output
    }
  }

  const f = async (value: number) => {
    await sleep(100)
    return value * 2
  }

  const values = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
  const result: number[] = []
  for await (const value of unordered(f, 3)(values)) {
    result.push(value)
  }
  expect(result.sort(Cmp.number)).toEqual(values.map(v => v * 2))

})
