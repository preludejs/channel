import { sleep, spawn } from './test.js'
import Ch from '../index.js'

test('simple', async () => {
  const a = new Ch<number>
  const b = new Ch<string>
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
  const a = new Ch<number>
  const b = new Ch<string>
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
