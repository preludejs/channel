
export function spawn(length: number, f: (worker: number) => Promise<void>) {
  return Promise.allSettled(Array.from({ length }, (_, index) => f(index)))
}

export function sleep(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds))
}

export function afterRandom(maxMilliseconds: number, thunk: () => void) {
  sleep(Math.floor(Math.random() * maxMilliseconds))
    .then(thunk)
    .catch(console.error)
}
