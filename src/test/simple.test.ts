import * as Ch from '../index.js'
import * as G from '@prelude/async-generator'
import { writeAfter } from './write-after.js'

test('simple', async () => {
  const ch = Ch.of<number>()
  const timeline: unknown[] = []

  Ch.write(ch, 3).then(() => timeline.push([ 'enqueued', 3 ]))
  Ch.write(ch, 5).then(() => timeline.push([ 'enqueued', 5 ]))
  Ch.write(ch, 7).then(() => timeline.push([ 'enqueued', 7 ]))

  for await (const value of G.take(3)(ch)) {
    timeline.push([ 'processed', value ])
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
        Ch.write(ch, value)
      }, Math.random() * 100)
      return ch
    }

  const a = delayedNumber(3)
  const b = delayedNumber(5)

  expect(await Ch.read(a) +  await Ch.read(b)).toEqual(8)
})

test('two delayed writes, two reads', async () => {
  const a = Ch.of<number>()
  writeAfter(a, 3, Math.random() * 1000)
    .catch(() => undefined)
  writeAfter(a, 5, Math.random() * 1000)
    .catch(() => undefined)
  expect(await Ch.read(a) + await Ch.read(a)).toEqual(8)
})
