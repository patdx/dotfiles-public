import { assertEquals, assertRejects } from '@std/assert'
import type { CommandResult, UpdateRuntime } from './update.ts'
import { prefixWithFnm, update } from './update.ts'

interface MockRuntimeOptions {
  platform?: string
  existingCommands?: string[]
  quietResults?: Record<string, CommandResult>
  failingCommands?: string[]
}

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
      runQuiet: (command: string[]) =>
        Promise.resolve(
          quietResults[command.join(' ')] ?? { code: 1, stdout: '' },
        ),
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
    ['npm', 'update', '--global'],
    ['claude', 'update'],
    ['pi', 'update', '--all'],
    ['cursor-agent', 'update'],
    ['copilot', 'update'],
    ['cmd', 'update'],
    ['herdr', 'update'],
  ])
})

Deno.test('update runs node ecosystem through fnm context', async () => {
  const initialPackages = JSON.stringify({
    dependencies: {
      claude: {},
      opencode: {},
    },
  })
  const currentPackages = JSON.stringify({
    dependencies: {
      claude: {},
    },
  })

  const { runtime, calls } = createMockRuntime({
    existingCommands: ['fnm', 'npm'],
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
    ['fnm', 'exec', '--using', '24', 'npm', 'install', '-g', 'opencode'],
    ['fnm', 'exec', '--using', '24', 'npm', 'update', '--global'],
    ['fnm', 'exec', '--using', '24', 'pnpm', 'self-update'],
    ['fnm', 'exec', '--using', '24', 'pnpm', 'update', '--global'],
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
