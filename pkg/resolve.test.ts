import { assertEquals } from '@std/assert'
import { resolvePackage } from './resolve.ts'
import { availableProviders } from './shared/url-checker.ts'

Deno.test('resolvePackage finds builtin catalog entries', async () => {
  const pkg = await resolvePackage('caddy')
  assertEquals(pkg.name, 'caddy')
  assertEquals(pkg.binary_name, 'caddy')
  assertEquals(pkg.files[0].url_provider, 'github')
  assertEquals(pkg.source.startsWith('builtin:'), true)
})

Deno.test('resolvePackage finds windsurf with named provider', async () => {
  const pkg = await resolvePackage('windsurf')
  assertEquals(pkg.files[0].url_provider, 'windsurf-stable')
  assertEquals(availableProviders.includes('windsurf-stable'), true)
})
