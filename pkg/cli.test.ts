import { assert, assertEquals, assertThrows } from '@std/assert'
import { assertManagedPackageName } from './shared/fs.ts'

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

Deno.test('pkg help lists outdated and update', async () => {
  const cliPath = new URL('./cli.ts', import.meta.url).pathname
  const output = await new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', cliPath, '--help'],
    stdout: 'piped',
    stderr: 'piped',
  }).output()

  const stdout = new TextDecoder().decode(output.stdout)
  const stderr = new TextDecoder().decode(output.stderr)

  assert(output.success, stderr)
  assert(stdout.includes('outdated'), stdout)
  assert(stdout.includes('update [name...]'), stdout)
})

Deno.test('legacy self-update and self-install show npm migration instructions without installing', async () => {
  const root = await Deno.makeTempDir({ prefix: 'pkg-migration-test-' })
  const cliPath = new URL('./cli.ts', import.meta.url).pathname
  try {
    const bin = `${root}/bin`
    await Deno.mkdir(bin)
    await Deno.writeTextFile(`${bin}/ppkg`, '#!/bin/sh\nexit 1\n')
    await Deno.chmod(`${bin}/ppkg`, 0o755)
    for (const command of ['self-update', 'self-install']) {
      const output = await new Deno.Command(Deno.execPath(), {
        args: ['run', '-A', cliPath, command],
        env: { PATH: bin, DENO_INSTALL_ROOT: root },
        stdout: 'piped',
        stderr: 'piped',
      }).output()
      const stdout = new TextDecoder().decode(output.stdout)
      assert(output.success, new TextDecoder().decode(output.stderr))
      assert(stdout.includes('npm install -g @patdx/ppkg'), stdout)
      assert(stdout.includes('deno uninstall -g ppkg'), stdout)
      assert(stdout.includes(`takes precedence: ${bin}/ppkg`), stdout)
      assert(stdout.includes('are preserved'), stdout)
    }
    assertEquals(await Deno.readTextFile(`${bin}/ppkg`), '#!/bin/sh\nexit 1\n')
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})
