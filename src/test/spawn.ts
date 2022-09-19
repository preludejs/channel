
export const spawn =
  (length: number, f: (worker: number) => Promise<void>) =>
    Promise.allSettled(Array.from({ length }, (_, index) => f(index)))
