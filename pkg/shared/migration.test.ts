import { assertEquals, assertStringIncludes } from '@std/assert'
import { isLegacyLauncher, migrationMessage } from './migration.ts'

Deno.test('migration guide preserves data and orders launcher removal after npm installation', () => {
  const message = migrationMessage(
    '/home/test/.deno/bin/ppkg',
    '/home/test/.deno',
  )
  assertStringIncludes(message, 'npm install -g @patdx/ppkg')
  assertStringIncludes(message, 'Node.js >=22.18')
  assertStringIncludes(message, '~/.ppkg')
  assertStringIncludes(message, 'preserved')
  assertStringIncludes(message, 'takes precedence: /home/test/.deno/bin/ppkg')
  assertEquals(
    message.indexOf('npm install') < message.indexOf('deno uninstall'),
    true,
  )
})

Deno.test('legacy launcher detection handles custom DENO_INSTALL_ROOT without confusing npm launchers', () => {
  assertEquals(isLegacyLauncher('/opt/deno/bin/ppkg', '/opt/deno'), true)
  assertEquals(isLegacyLauncher('/usr/local/bin/ppkg', '/opt/deno'), false)
  assertEquals(
    migrationMessage('/usr/local/bin/ppkg', '/opt/deno').includes(
      'takes precedence:',
    ),
    false,
  )
})
