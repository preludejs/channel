import { writeAfter } from './test/write-after.js'
import * as Ch from './index.js'
import { sleep } from './test/sleep.js'

test('write, read on semaphore', async () => {
  const ch = Ch.of<number>()
  Ch.write(ch, 3)
  await expect(Ch.read(ch)).resolves.toEqual(3)
})

test('two delayed writes, two reads', async () => {
  const ch = Ch.of<number>()
  writeAfter(ch, 3, Math.floor(Math.random() * 100))
    .catch(() => undefined)
  writeAfter(ch, 5, Math.floor(Math.random() * 100))
    .catch(() => undefined)
  const a = await Ch.read(ch)
  const b = await Ch.read(ch)
  expect(a + b).toEqual(8)
  await sleep(2000)
})
