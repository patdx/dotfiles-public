import { assert, assertEquals, assertThrows } from '@std/assert'
import { assertManagedPackageName } from './shared/shared.ts'

Deno.test('assertManagedPackageName rejects path traversal', () => {
  assertEquals(
    assertManagedPackageName('git-credential-manager'),
    'git-credential-manager',
  )
  assertThrows(
    () => assertManagedPackageName('../../outside'),
    Error,
    'Invalid package name',
  )
  assertThrows(
    () => assertManagedPackageName('nested/path'),
    Error,
    'Invalid package name',
  )
})

Deno.test('pkg list finds known packages outside repo cwd', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'pkg-list-test-' })
  const cliPath = new URL('./cli.ts', import.meta.url).pathname

  try {
    const output = await new Deno.Command(Deno.execPath(), {
      args: ['run', '-A', cliPath, 'list'],
      cwd: tempDir,
      stdout: 'piped',
      stderr: 'piped',
    }).output()

    const stdout = new TextDecoder().decode(output.stdout)
    const stderr = new TextDecoder().decode(output.stderr)

    assert(output.success, stderr)
    assert(stdout.includes('Available packages:'), stdout)
    assert(stdout.includes('  caddy'), stdout)
    assert(!stdout.includes('  No packages available'), stdout)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
