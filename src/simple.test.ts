import * as Ch from './index.js'
import { afterRandom } from './test.js'

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
