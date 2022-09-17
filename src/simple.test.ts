import * as Ch from './index.js'
import * as G from '@prelude/async-generator'

test('simple', async () => {
  const ch = Ch.of<number>()
  const timeline: unknown[] = []

  Ch.send(ch, 3).then(() => timeline.push([ 'sent', 3 ]))
  Ch.send(ch, 5).then(() => timeline.push([ 'sent', 5 ]))
  Ch.send(ch, 7).then(() => timeline.push([ 'sent', 7 ]))

  for await (const value of G.take(3)(ch)) {
    timeline.push([ 'received', value ])
  }

  expect(timeline).toEqual([
    [ 'sent', 3 ],
    [ 'received', 3 ],
    [ 'sent', 5 ],
    [ 'received', 5 ],
    [ 'sent', 7 ],
    [ 'received', 7 ]
  ])
})

test('delayed receive', async () => {

  const delayedNumber =
    (value: number) => {
      const ch = Ch.of<number>()
      setTimeout(() => {
        Ch.send(ch, value)
      }, Math.random() * 100)
      return ch
    }

  const a = delayedNumber(3)
  const b = delayedNumber(5)

  const sum =
    (x: number, y: number) =>
      x + y

  expect(sum(await Ch.receive(a), await Ch.receive(b))).toEqual(8)
})


test('delayed send', async () => {
  const a = Ch.of<number>()
  const b = Ch.of<number>()
  const delayedSend =
    (ch: Ch.t<number>, value: number) => {
      setTimeout(() => {
        Ch.send(ch, value)
      }, Math.random() * 1000)
    }
  delayedSend(a, 3)
  delayedSend(b, 5)
  const sum =
    (x: number, y: number) =>
      x + y
  expect(sum(await Ch.receive(a), await Ch.receive(b))).toEqual(8)
})

test('single delayed send', async () => {
  const a = Ch.of<number>()
  const delayedSend =
    (value: number) => {
      setTimeout(() => {
        Ch.send(a, value)
      }, Math.random() * 1000)
    }
  delayedSend(3)
  delayedSend(5)
  const sum =
    (x: number, y: number) =>
      x + y
  expect(sum(await Ch.receive(a), await Ch.receive(a))).toEqual(8)
})
