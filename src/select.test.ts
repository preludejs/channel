import { spawn } from './test/spawn.js'
import * as Ch from './index.js'
import { sleep } from './test/sleep.js'

test('simple', async () => {
  const a = Ch.of<number>()
  const b = Ch.of<number>()
  Ch.write(a, 1)
  Ch.write(b, 2)
  const g = Ch.select(a, b)
  const c = await g.next()
  expect(a.writes.length === 0 || b.writes.length == 0).toBe(true)
  const d = await g.next()
  expect(a.writes.length === 0 && b.writes.length == 0).toBe(true)
  if (c.value === 1) {
    expect(d.value).toEqual(2)
  } else {
    expect(d.value).toEqual(1)
  }
})

test('select', async () => {
  const a = Ch.of<number>(0)
  const b = Ch.of<string>(0)
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
      Ch.write(a, i)
    } else {
      Ch.write(b, i.toString())
    }
  }

  await sleep(2 * 1000)

  expect(results.length).toEqual(100)

})
