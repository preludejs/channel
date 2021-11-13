import * as Ch from '../cjs/index.js'

test('select', async () => {
  const a = Ch.of<number>()
  const b = Ch.of<string>()
  const results: string[] = []

  const sink =
    async function* () {
      while (true) {
        yield await Ch.select(a, b)
      }
    }

  ;(async () => {
    for await (const _ of sink()) {
      results.push(`A   ${_.value}`)
      if (Math.random() > 0.5) {
        await new Promise(resolve => setTimeout(resolve, Math.round(Math.random() * 10)))
      }
    }
  })()

  ;(async () => {
    for await (const _ of sink()) {
      results.push(` B  ${_.value}`)
      if (Math.random() > 0.5) {
        await new Promise(resolve => setTimeout(resolve, Math.round(Math.random() * 10)))
      }
    }
  })()

  ;(async () => {
    for await (const _ of sink()) {
      results.push(`  C ${_.value}`)
      if (Math.random() > 0.5) {
        await new Promise(resolve => setTimeout(resolve, Math.round(Math.random() * 10)))
      }
    }
  })()

  for (let i = 0; i < 100; i++) {
    if (Math.random() > 0.5) {
      Ch.send(a, i)
    } else {
      Ch.send(b, i.toString())
    }
  }

  await new Promise(resolve => setTimeout(resolve, 2000))

  expect(results.length).toEqual(100)

})
