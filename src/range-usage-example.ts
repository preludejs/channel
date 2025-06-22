import * as Ch from './index.js'

/**
 * Example demonstrating the difference between JavaScript and Go semantics
 * for channel async iteration.
 */

async function jsSemantics() {
  console.log('=== JavaScript Semantics (Default) ===')

  const ch = Ch.of<number>()

  // Fill with some data
  ch.writeIgnore(1)
  ch.writeIgnore(2)
  ch.writeIgnore(3)

  // Use default async iteration
  for await (const value of ch) {
    console.log('Received:', value)
    if (value === 2) {
      console.log('Breaking early...')
      break // This will close the channel (JS semantics)
    }
  }

  console.log('Channel closed:', ch.doneWriting) // true
  console.log('Trying to read remaining data...')

  try {
    await ch.read() // This will throw because channel is closed
  } catch (error) {
    console.log('Error:', error)
  }

  console.log()
}

async function goSemantics() {
  console.log('=== Go Semantics (via .range) ===')

  const ch = Ch.of<number>()

  // Fill with some data
  ch.writeIgnore(1)
  ch.writeIgnore(2)
  ch.writeIgnore(3)

  // Use .range for Go-like behavior
  for await (const value of ch.range) {
    console.log('Received:', value)
    if (value === 2) {
      console.log('Breaking early...')
      break // This will NOT close the channel (Go semantics)
    }
  }

  console.log('Channel closed:', ch.doneWriting) // false
  console.log('Reading remaining data...')

  const remaining = await ch.read()
  console.log('Got remaining value:', remaining) // 3

  console.log()
}

async function producerConsumerExample() {
  console.log('=== Producer-Consumer Pattern ===')

  const ch = Ch.of<string>()

  // Producer (simulates a background task)
  const producer = async () => {
    const messages = ['hello', 'world', 'from', 'producer']
    for (const msg of messages) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await ch.write(msg)
      console.log('Produced:', msg)
    }
    ch.closeWriting() // Signal that no more data will be sent
    console.log('Producer finished')
  }

  // Consumer using Go semantics
  const consumer = async () => {
    console.log('Consumer starting...')
    for await (const message of ch.range) {
      console.log('Consumed:', message)
    }
    console.log('Consumer finished')
  }

  // Run producer and consumer concurrently
  await Promise.all([producer(), consumer()])

  console.log()
}

async function multipleConsumersExample() {
  console.log('=== Multiple Consumers (Competitive) ===')

  const ch = Ch.of<number>()

  // Producer
  const producer = async () => {
    for (let i = 1; i <= 10; i++) {
      await ch.write(i)
      console.log('Produced:', i)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    ch.closeWriting()
  }

  // Consumer factory
  const createConsumer = (id: string) => async () => {
    const consumed: number[] = []
    for await (const value of ch.range) {
      consumed.push(value)
      console.log(`Consumer ${id} got:`, value)
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
    }
    console.log(`Consumer ${id} finished with:`, consumed)
  }

  // Run producer with multiple consumers
  await Promise.all([producer(), createConsumer('A')(), createConsumer('B')(), createConsumer('C')()])

  console.log()
}

async function bufferedChannelExample() {
  console.log('=== Buffered Channel Example ===')

  const ch = Ch.of<string>(3) // Buffer size of 3

  // Fill buffer immediately
  ch.writeIgnore('first')
  ch.writeIgnore('second')
  ch.writeIgnore('third')

  console.log('Buffer filled with 3 items')

  // Read one item with early break using Go semantics
  for await (const value of ch.range) {
    console.log('Read:', value)
    console.log('Breaking after first item...')
    break
  }

  console.log('Channel still has data:', !ch.done)
  console.log('Remaining items:', await ch.read(), await ch.read())

  console.log()
}

async function main() {
  console.log('Channel Async Iteration Examples\n')

  await jsSemantics()
  await goSemantics()
  await producerConsumerExample()
  await multipleConsumersExample()
  await bufferedChannelExample()

  console.log('All examples completed!')
}

// Run examples
main().catch(console.error)
