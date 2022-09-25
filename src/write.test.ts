import * as Ch from './index.js'
import { afterRandom } from './test.js'

test('write, read on semaphore', async () => {
  const ch = Ch.of<number>()
  ch.writeIgnore(3)
  await expect(ch.read()).resolves.toEqual(3)
})

test('two delayed writes, two reads', async () => {
  const ch = Ch.of<number>()
  afterRandom(100, () => ch.write(3))
  afterRandom(100, () => ch.write(5))
  const a = await ch.read()
  const b = await ch.read()
  expect(a + b).toEqual(8)
})
