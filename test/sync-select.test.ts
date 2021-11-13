import * as Ch from '../cjs/index.js'

test('1', async () => {
  const a = Ch.of<number>()
  const b = Ch.of<number>()
  const c = Ch.select(a, b)
  Ch.send(a, 1)
  Ch.send(b, 2)
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(a.writes.length === 0 && b.writes.length === 1).toBe(true)
  await expect(c).resolves.toEqual({ value: 1 })
})
