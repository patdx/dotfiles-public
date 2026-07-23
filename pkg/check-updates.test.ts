import { assertEquals, assertRejects } from '@std/assert'
import {
  type CheckAvailableFn,
  checkPackageUpdates,
  type ResolvePackageFn,
  statusFromVersions,
} from './check-updates.ts'
import type { ResolvedPackage } from './resolve.ts'

function fakeResolved(name: string): ResolvedPackage {
  return {
    name,
    source: 'test',
    binary_name: name,
    files: [{ url: `https://example.com/${name}`, url_provider: 'direct' }],
  }
}

Deno.test('statusFromVersions uses string equality', () => {
  assertEquals(statusFromVersions('1.0.0', '1.0.0'), 'current')
  assertEquals(statusFromVersions('1.0.0', '1.1.0'), 'outdated')
  assertEquals(statusFromVersions('latest', 'latest'), 'current')
  assertEquals(statusFromVersions('v1.0.0', '1.0.0'), 'outdated')
})

Deno.test('checkPackageUpdates marks outdated and current', async () => {
  const resolve: ResolvePackageFn = (name) =>
    Promise.resolve(fakeResolved(name))
  const checkAvailable: CheckAvailableFn = (pkg) => {
    if (pkg.name === 'caddy') return Promise.resolve('2.9.0')
    if (pkg.name === 'duckdb') return Promise.resolve('1.2.0')
    return Promise.resolve('latest')
  }

  const results = await checkPackageUpdates(
    [
      { name: 'caddy', version: '2.8.0' },
      { name: 'duckdb', version: '1.2.0' },
    ],
    { resolve, checkAvailable },
  )

  assertEquals(results.map((r) => ({ name: r.name, status: r.status })), [
    { name: 'caddy', status: 'outdated' },
    { name: 'duckdb', status: 'current' },
  ])
  assertEquals(results[0].available, '2.9.0')
  assertEquals(results[0].resolved?.name, 'caddy')
})

Deno.test('checkPackageUpdates skips packages not in catalog', async () => {
  const resolve: ResolvePackageFn = (name) =>
    Promise.reject(new Error(`Unknown package '${name}'`))
  const checkAvailable: CheckAvailableFn = () => Promise.resolve('1.0.0')

  const results = await checkPackageUpdates(
    [{ name: 'custom-bin', version: '0.1.0' }],
    { resolve, checkAvailable },
  )

  assertEquals(results.length, 1)
  assertEquals(results[0].status, 'skipped')
  assertEquals(results[0].reason?.includes('Unknown package'), true)
})

Deno.test('checkPackageUpdates reports provider errors', async () => {
  const resolve: ResolvePackageFn = (name) =>
    Promise.resolve(fakeResolved(name))
  const checkAvailable: CheckAvailableFn = () =>
    Promise.reject(new Error('rate limited'))

  const results = await checkPackageUpdates(
    [{ name: 'caddy', version: '2.8.0' }],
    { resolve, checkAvailable },
  )

  assertEquals(results[0].status, 'error')
  assertEquals(results[0].reason, 'rate limited')
})

Deno.test('checkPackageUpdates filters by names and rejects missing', async () => {
  const resolve: ResolvePackageFn = (name) =>
    Promise.resolve(fakeResolved(name))
  const checkAvailable: CheckAvailableFn = () => Promise.resolve('2.0.0')

  const results = await checkPackageUpdates(
    [
      { name: 'caddy', version: '1.0.0' },
      { name: 'duckdb', version: '1.0.0' },
    ],
    { names: ['caddy'], resolve, checkAvailable },
  )
  assertEquals(results.length, 1)
  assertEquals(results[0].name, 'caddy')

  await assertRejects(
    () =>
      checkPackageUpdates(
        [{ name: 'caddy', version: '1.0.0' }],
        { names: ['missing'], resolve, checkAvailable },
      ),
    Error,
    'Not installed: missing',
  )
})
