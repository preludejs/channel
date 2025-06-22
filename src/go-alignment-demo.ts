import * as Ch from './index.js'

// Demonstrate JS vs Go semantics for async iteration
async function demonstrateSemantics() {
  console.log('=== Channel Async Iteration: JS vs Go Semantics ===\n')

  // 1. Comparison of JS vs Go semantics when breaking out of iteration
  console.log('1. Breaking out of iteration - JS vs Go semantics:')

  // JS semantics (default)
  console.log('   JS semantics (default iterator):')
  const ch1js = Ch.of<number>()
  ch1js.writeIgnore(1)
  ch1js.writeIgnore(2)
  ch1js.writeIgnore(3)

  const values1js: number[] = []
  for await (const value of ch1js) {
    values1js.push(value)
    console.log(`     Read: ${value}`)
    if (value === 2) {
      console.log('     Breaking out of loop...')
      break
    }
  }
  console.log(`     Channel closed: ${ch1js.doneWriting} (JS semantics)`)

  // Go semantics (.range)
  console.log('   Go semantics (.range iterator):')
  const ch1go = Ch.of<number>()
  ch1go.writeIgnore(1)
  ch1go.writeIgnore(2)
  ch1go.writeIgnore(3)

  const values1go: number[] = []
  for await (const value of ch1go.range) {
    values1go.push(value)
    console.log(`     Read: ${value}`)
    if (value === 2) {
      console.log('     Breaking out of loop...')
      break
    }
  }
  console.log(`     Channel still open: ${!ch1go.doneWriting} (Go semantics)`)
  console.log(`     Can still read: ${await ch1go.read()}`)
  console.log()

  // 2. Iterator return() behavior comparison
  console.log('2. Iterator return() behavior - JS vs Go semantics:')

  // JS semantics
  console.log('   JS semantics (default iterator):')
  const ch2js = Ch.of<string>()
  ch2js.writeIgnore('a')
  ch2js.writeIgnore('b')

  const iteratorJs = ch2js[Symbol.asyncIterator]()
  const resultJs = await iteratorJs.next()
  console.log(`     Read via iterator: ${resultJs.value}`)

  await iteratorJs.return()
  console.log(`     Called iterator.return()`)
  console.log(`     Channel closed: ${ch2js.doneWriting} (JS semantics)`)

  // Go semantics
  console.log('   Go semantics (.range iterator):')
  const ch2go = Ch.of<string>()
  ch2go.writeIgnore('a')
  ch2go.writeIgnore('b')

  const iteratorGo = ch2go.range[Symbol.asyncIterator]()
  const resultGo = await iteratorGo.next()
  console.log(`     Read via iterator: ${resultGo.value}`)

  await iteratorGo.return?.()
  console.log(`     Called iterator.return()`)
  console.log(`     Channel still open: ${!ch2go.doneWriting} (Go semantics)`)
  console.log(`     Can still read directly: ${await ch2go.read()}`)
  console.log()

  // 3. Normal iteration until channel is closed (same for both)
  console.log('3. Normal iteration until channel is closed (same behavior):')
  const ch3 = Ch.of<number>()

  // Simulate producer goroutine
  setTimeout(() => {
    console.log('   Producer: writing 10')
    ch3.writeIgnore(10)
  }, 10)

  setTimeout(() => {
    console.log('   Producer: writing 20')
    ch3.writeIgnore(20)
  }, 20)

  setTimeout(() => {
    console.log('   Producer: writing 30 and closing')
    ch3.writeIgnore(30)
    ch3.closeWriting()
  }, 30)

  const values3: number[] = []
  console.log('   Consumer: starting iteration...')
  for await (const value of ch3.range) {
    console.log(`   Consumer: received ${value}`)
    values3.push(value)
  }
  console.log(`   Consumer: iteration complete, received: [${values3.join(', ')}]`)
  console.log(`   Channel is done: ${ch3.done}`)
  console.log()

  // 4. Multiple iterators comparison
  console.log('4. Multiple iterators - JS vs Go semantics:')

  // JS semantics - first iterator return() closes channel
  console.log('   JS semantics (default iterators):')
  const ch4js = Ch.of<number>()
  ch4js.writeIgnore(100)
  ch4js.writeIgnore(200)
  ch4js.writeIgnore(300)

  const iter1js = ch4js[Symbol.asyncIterator]()
  const iter2js = ch4js[Symbol.asyncIterator]()

  const result1js = await iter1js.next()
  const result2js = await iter2js.next()

  console.log(`     Iterator 1 got: ${result1js.value}`)
  console.log(`     Iterator 2 got: ${result2js.value}`)

  await iter1js.return()
  console.log(`     Terminated iterator 1 - channel closed: ${ch4js.doneWriting}`)

  // Go semantics - iterator return() doesn't close channel
  console.log('   Go semantics (.range iterators):')
  const ch4go = Ch.of()
  ch4go.writeIgnore(100)
  ch4go.writeIgnore(200)
  ch4go.writeIgnore(300)

  const iter1go = ch4go.range[Symbol.asyncIterator]()
  const iter2go = ch4go.range[Symbol.asyncIterator]()

  const result1go = await iter1go.next()
  const result2go = await iter2go.next()

  console.log(`     Iterator 1 got: ${result1go.value}`)
  console.log(`     Iterator 2 got: ${result2go.value}`)

  await iter1go.return?.()
  console.log(`     Terminated iterator 1 - channel still open: ${!ch4go.doneWriting}`)

  const result3go = await iter2go.next()
  console.log(`     Iterator 2 can still read: ${result3go.value}`)
  console.log()

  // 5. Buffered channel behavior comparison
  console.log('5. Buffered channel with early break - JS vs Go semantics:')

  // JS semantics
  console.log('   JS semantics (default iterator):')
  const ch5js = Ch.of<number | string>(3)
  ch5js.writeIgnore(100)
  ch5js.writeIgnore('y')
  ch5js.writeIgnore('z')

  const values5js: (number | string)[] = []
  for await (const value of ch5js) {
    values5js.push(value)
    console.log(`     Read from buffer: ${value}`)
    if (value === 'y') {
      console.log('     Breaking early...')
      break
    }
  }
  console.log(`     Channel closed: ${ch5js.doneWriting} (JS semantics)`)

  // Go semantics
  console.log('   Go semantics (.range iterator):')
  const ch5go = Ch.of<string>(3)
  ch5go.writeIgnore('x')
  ch5go.writeIgnore('y')
  ch5go.writeIgnore('z')

  const values5go: string[] = []
  for await (const value of ch5go.range) {
    values5go.push(value)
    console.log(`     Read from buffer: ${value}`)
    if (value === 'y') {
      console.log('     Breaking early...')
      break
    }
  }
  console.log(`     Channel still has data: ${!ch5go.done} (Go semantics)`)
  console.log(`     Can read remaining: ${await ch5go.read()}`)
  console.log()

  console.log('=== Demo Complete ===')
  console.log('Key differences:')
  console.log('• Default iteration: JS semantics - breaking/return() closes the channel')
  console.log('• .range iteration: Go semantics - breaking/return() does NOT close the channel')
  console.log('• Use for await (const x of channel) for JS behavior')
  console.log('• Use for await (const x of channel.range) for Go behavior')
  console.log('• Both approaches support competitive consumption and buffered channels')
}

// Run the demo
demonstrateSemantics().catch(console.error)
