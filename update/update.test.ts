import { assertEquals, assertRejects } from '@std/assert'
import type { CommandResult, UpdateRuntime } from './update.ts'
import { parseGlobalNpmPackages, prefixWithFnm, update } from './update.ts'

interface MockRuntimeOptions {
  platform?: string
  existingCommands?: string[]
  /** Queues return one result per call; the last result repeats. */
  quietResults?: Record<string, CommandResult | CommandResult[]>
  failingCommands?: string[]
}

const FNM_GLOBAL_NODE_MODULES =
  '/home/pm/.local/share/fnm/node-versions/v24.22.0/installation/lib/node_modules'

function createMockRuntime(
  options: MockRuntimeOptions = {},
): { runtime: UpdateRuntime; calls: string[][] } {
  const calls: string[][] = []
  const existingCommands = new Set(options.existingCommands ?? [])
  const quietResults = options.quietResults ?? {}
  const failingCommands = new Set(options.failingCommands ?? [])

  return {
    calls,
    runtime: {
      platform: options.platform ?? 'darwin',
      commandExists: (command: string) =>
        Promise.resolve(existingCommands.has(command)),
      run: (command: string[]) => {
        calls.push(command)
        if (failingCommands.has(command.join(' '))) {
          return Promise.reject(
            new Error(`Mock failure: ${command.join(' ')}`),
          )
        }
        return Promise.resolve()
      },
      runQuiet: (command: string[]) => {
        const result = quietResults[command.join(' ')]
        if (Array.isArray(result)) {
          const next = result.length > 1 ? result.shift() : result[0]
          return Promise.resolve(next ?? { code: 1, stdout: '' })
        }
        return Promise.resolve(result ?? { code: 1, stdout: '' })
      },
      updateGitCredentialManager: () => {
        calls.push(['gcm-update'])
        return Promise.resolve()
      },
    },
  }
}

Deno.test('update runs in strict order without pnpm blocking claude', async () => {
  const { runtime, calls } = createMockRuntime({
    existingCommands: [
      'bun',
      'deno',
      'npm',
      'claude',
      'pi',
      'cursor-agent',
      'copilot',
      'cmd',
      'herdr',
    ],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['bun', 'upgrade'],
    ['deno', 'upgrade'],
    ['npm', 'uninstall', '--global', 'corepack'],
    ['npm', 'update', '--global'],
    ['claude', 'update'],
    ['pi', 'update', '--all'],
    ['cursor-agent', 'update'],
    ['copilot', 'update'],
    ['cmd', 'update'],
    ['herdr', 'update'],
  ])
})

Deno.test('update removes Corepack without restoring it and uses standalone pnpm', async () => {
  const initialPackages = JSON.stringify({
    dependencies: {
      claude: {},
      opencode: {},
      corepack: {},
    },
  })
  const currentPackages = JSON.stringify({
    dependencies: {
      claude: {},
    },
  })

  const { runtime, calls } = createMockRuntime({
    existingCommands: ['fnm', 'npm', 'pnpm'],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: initialPackages,
      },
      'fnm exec --using 24 npm --version': {
        code: 0,
        stdout: '10.0.0',
      },
      'fnm exec --using 24 npm ls -g --json': {
        code: 0,
        stdout: currentPackages,
      },
      'fnm exec --using 24 pnpm --version': {
        code: 0,
        stdout: '10.0.0',
      },
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['fnm', 'install', '24'],
    ['fnm', 'default', '24'],
    [
      'fnm',
      'exec',
      '--using',
      '24',
      'npm',
      'uninstall',
      '--global',
      'corepack',
    ],
    ['fnm', 'exec', '--using', '24', 'npm', 'install', '-g', 'opencode'],
    ['fnm', 'exec', '--using', '24', 'npm', 'update', '--global'],
    ['pnpm', 'self-update'],
    ['pnpm', 'update', '--global'],
  ])
})

Deno.test('update keeps linux system steps sequential', async () => {
  const { runtime, calls } = createMockRuntime({
    platform: 'linux',
    existingCommands: [
      'git-credential-manager',
      'snap',
      'dnf',
      'apt',
    ],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['gcm-update'],
    ['sudo', 'snap', 'refresh'],
    ['sudo', 'dnf', 'upgrade', '--refresh'],
    ['sudo', 'apt', 'update'],
    ['sudo', 'apt', 'upgrade'],
  ])
})

Deno.test('update uses pnpm self-update without corepack', async () => {
  const { runtime, calls } = createMockRuntime({
    existingCommands: ['npm', 'pnpm'],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['npm', 'uninstall', '--global', 'corepack'],
    ['npm', 'update', '--global'],
    ['pnpm', 'self-update'],
    ['pnpm', 'update', '--global'],
  ])
})

Deno.test('update continues past failures and reports them', async () => {
  const { runtime, calls } = createMockRuntime({
    existingCommands: ['bun', 'deno', 'claude'],
    failingCommands: ['bun upgrade'],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  const error = await assertRejects(() => update(runtime), Error)
  assertEquals(error.message.includes('bun'), true)

  // deno and claude still ran despite bun failing
  assertEquals(calls, [
    ['bun', 'upgrade'],
    ['deno', 'upgrade'],
    ['claude', 'update'],
  ])
})

Deno.test('pnpm self-update failure does not skip pnpm global update', async () => {
  const { runtime, calls } = createMockRuntime({
    existingCommands: ['pnpm'],
    failingCommands: ['pnpm self-update'],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  const error = await assertRejects(() => update(runtime), Error)
  assertEquals(error.message.includes('pnpm self-update'), true)

  assertEquals(calls, [
    ['pnpm', 'self-update'],
    ['pnpm', 'update', '--global'],
  ])
})

Deno.test('apt upgrade still runs when apt update fails', async () => {
  const { runtime, calls } = createMockRuntime({
    platform: 'linux',
    existingCommands: ['apt'],
    failingCommands: ['sudo apt update'],
    quietResults: {
      'npm ls -g --json': {
        code: 0,
        stdout: JSON.stringify({ dependencies: {} }),
      },
    },
  })

  const error = await assertRejects(() => update(runtime), Error)
  assertEquals(error.message.includes('apt update'), true)

  assertEquals(calls, [
    ['sudo', 'apt', 'update'],
    ['sudo', 'apt', 'upgrade'],
  ])
})

Deno.test('update restores linked global packages from their local source', async () => {
  const initialPackages = JSON.stringify({
    dependencies: {
      svgma: {
        version: '0.1.0',
        resolved: 'file:../../../../../../../../dev/home/svgma',
      },
      typescript: { version: '7.0.2' },
    },
  })
  const currentPackages = JSON.stringify({
    dependencies: {
      typescript: { version: '7.0.2' },
    },
  })

  const { runtime, calls } = createMockRuntime({
    existingCommands: ['npm'],
    quietResults: {
      'npm root -g': { code: 0, stdout: `${FNM_GLOBAL_NODE_MODULES}\n` },
      'npm ls -g --json': [
        { code: 0, stdout: initialPackages },
        { code: 0, stdout: currentPackages },
      ],
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['npm', 'uninstall', '--global', 'corepack'],
    ['npm', 'install', '-g', '/home/pm/dev/home/svgma'],
    ['npm', 'update', '--global'],
  ])
})

Deno.test('update keeps restoring packages when a local package fails', async () => {
  const initialPackages = JSON.stringify({
    dependencies: {
      gone: { version: '0.1.0', resolved: 'file:/home/pm/dev/home/gone' },
      typescript: { version: '7.0.2' },
    },
  })
  const emptyPackages = JSON.stringify({ dependencies: {} })

  const { runtime, calls } = createMockRuntime({
    existingCommands: ['npm'],
    failingCommands: ['npm install -g /home/pm/dev/home/gone'],
    quietResults: {
      'npm ls -g --json': [
        { code: 0, stdout: initialPackages },
        { code: 0, stdout: emptyPackages },
      ],
    },
  })

  // An unrestorable local package is reported as a warning, not a failure.
  await update(runtime)

  assertEquals(calls, [
    ['npm', 'uninstall', '--global', 'corepack'],
    ['npm', 'install', '-g', '/home/pm/dev/home/gone'],
    ['npm', 'install', '-g', 'typescript'],
    ['npm', 'update', '--global'],
  ])
})

Deno.test('one unavailable registry package does not block the others', async () => {
  const initialPackages = JSON.stringify({
    dependencies: {
      unpublished: { version: '1.0.0' },
      typescript: { version: '7.0.2' },
    },
  })
  const emptyPackages = JSON.stringify({ dependencies: {} })

  const { runtime, calls } = createMockRuntime({
    existingCommands: ['npm'],
    failingCommands: ['npm install -g unpublished'],
    quietResults: {
      'npm ls -g --json': [
        { code: 0, stdout: initialPackages },
        { code: 0, stdout: emptyPackages },
      ],
    },
  })

  const error = await assertRejects(() => update(runtime), Error)
  assertEquals(error.message.includes('npm restore missing packages'), true)

  assertEquals(calls, [
    ['npm', 'uninstall', '--global', 'corepack'],
    ['npm', 'install', '-g', 'unpublished'],
    ['npm', 'install', '-g', 'typescript'],
    ['npm', 'update', '--global'],
  ])
})

Deno.test('parseGlobalNpmPackages resolves local installs', () => {
  const stdout = JSON.stringify({
    dependencies: {
      svgma: {
        version: '0.1.0',
        resolved: 'file:../../../../../../../../dev/home/svgma',
      },
      '@scope/linked': {
        version: '1.0.0',
        link: true,
        resolved: '/home/pm/dev/home/linked',
      },
      typescript: { version: '7.0.2' },
      tarball: { resolved: 'https://example.com/package.tgz' },
    },
  })

  assertEquals(parseGlobalNpmPackages(stdout, FNM_GLOBAL_NODE_MODULES), [
    { name: 'svgma', local: true, localPath: '/home/pm/dev/home/svgma' },
    {
      name: '@scope/linked',
      local: true,
      localPath: '/home/pm/dev/home/linked',
    },
    { name: 'typescript', local: false, localPath: undefined },
    { name: 'tarball', local: false, localPath: undefined },
  ])

  // A linked package without a resolvable path still counts as local.
  assertEquals(
    parseGlobalNpmPackages(
      JSON.stringify({ dependencies: { linked: { link: true } } }),
    ),
    [{ name: 'linked', local: true, localPath: undefined }],
  )

  assertEquals(parseGlobalNpmPackages('{"name":"lib"}'), undefined)
})

Deno.test('prefixWithFnm only rewrites node-managed commands when enabled', () => {
  assertEquals(prefixWithFnm(false, ['npm', 'update', '--global']), [
    'npm',
    'update',
    '--global',
  ])
  assertEquals(prefixWithFnm(true, ['npm', 'update', '--global']), [
    'fnm',
    'exec',
    '--using',
    '24',
    'npm',
    'update',
    '--global',
  ])
})
