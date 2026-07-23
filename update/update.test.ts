import { assertEquals } from '@std/assert'
import type { CommandResult, UpdateRuntime } from './update.ts'
import { prefixWithFnm, update } from './update.ts'

interface MockRuntimeOptions {
  platform?: string
  existingCommands?: string[]
  quietResults?: Record<string, CommandResult>
}

function createMockRuntime(
  options: MockRuntimeOptions = {},
): { runtime: UpdateRuntime; calls: string[][] } {
  const calls: string[][] = []
  const existingCommands = new Set(options.existingCommands ?? [])
  const quietResults = options.quietResults ?? {}

  return {
    calls,
    runtime: {
      platform: options.platform ?? 'darwin',
      commandExists: (command: string) =>
        Promise.resolve(existingCommands.has(command)),
      run: (command: string[]) => {
        calls.push(command)
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
      'cursor-agent',
      'copilot',
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
    ['cursor-agent', 'update'],
    ['copilot', 'update'],
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
      'fnm exec --using 24 corepack --version': {
        code: 0,
        stdout: '1.0.0',
      },
      'fnm exec --using 24 pnpm --version': {
        code: 0,
        stdout: '9.0.0',
      },
    },
  })

  await update(runtime)

  assertEquals(calls, [
    ['fnm', 'install', '24'],
    ['fnm', 'default', '24'],
    ['fnm', 'exec', '--using', '24', 'npm', 'install', '-g', 'opencode'],
    ['fnm', 'exec', '--using', '24', 'npm', 'update', '--global'],
    [
      'fnm',
      'exec',
      '--using',
      '24',
      'corepack',
      'install',
      '--global',
      'pnpm@latest',
    ],
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
