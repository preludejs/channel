[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=bugs)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=coverage)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=preludejs_channel&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=preludejs_channel)

---

# Channel module

# Usage

```bash
npm i -E @prelude/channel
```

```ts
import * as Ch from '@prelude/channel'
```

## Comparision with go channels

#### Go's `range`

Go's `for v := range ch` has slightly different semantics than async iteration in JavaScript.

In JavaScript generator is closed when breaking from the loop.

#### Comma-OK Go's Idiom

Go's `v, ok := <-ch` pattern is supported through:

`await ch.maybeRead()` which returns `undefined` when channel is closed or value if not.

`await ch.next()` returns `{ done: boolean, value: undefined | T }` ie. AsyncIterableResult.

#### Go's `select` with `default` Case

Go's select statement with a default case for non-blocking behavior is supported through:

`Ch.maybeSelect([ch1, ch2, writeAttempt])` which returns immediately with a result if any channel operation can proceed, or `undefined` if none are ready (equivalent to Go's default case).

```ts
// Go equivalent: select { case v := <-ch1: ...; case ch2 <- val: ...; default: ... }
const result = Ch.maybeSelect([ch1, ch2.writeAttempt(val, v => ({value: v}))])
if (result) {
  // One of the channel operations succeeded
  console.log('Got:', result.value)
} else {
  // Default case - no operations were ready
  console.log('No channels ready, doing something else')
}
```

#### No Comma-OK Idiom
Go's `v, ok := <-ch` pattern isn't directly supported. The `maybeRead()` method partially addresses this but isn't identical.

# License

```
MIT License

Copyright 2021 Mirek Rusin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
