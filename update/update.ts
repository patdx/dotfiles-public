#!/usr/bin/env -S deno run --allow-all

/**
 * This file does some general updates for Mac or Linux computer
 *
 * @module
 */

const textDecoder = new TextDecoder()
const FNM_NODE_VERSION = '24'

export interface CommandResult {
  code: number
  stdout: string
}

export interface UpdateRuntime {
  platform: string
  commandExists(command: string): Promise<boolean>
  run(command: string[]): Promise<void>
  runQuiet(command: string[]): Promise<CommandResult>
  updateGitCredentialManager(): Promise<void>
}

if (import.meta.main) {
  await update()
}

export async function update(
  runtime: UpdateRuntime = createRuntime(),
): Promise<void> {
  const failures: string[] = []
  const step = async (
    label: string,
    fn: () => Promise<unknown>,
  ): Promise<void> => {
    try {
      await fn()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Update step failed (${label}): ${message}`)
      failures.push(label)
    }
  }

  let initialNpmPackages: string[] = []
  await step('npm package inventory', async () => {
    initialNpmPackages = await getGlobalNpmPackages(runtime)
  })

  let hasFnm = false
  await step('fnm detection', async () => {
    hasFnm = await runtime.commandExists('fnm')
  })

  await step('bun', () => runIfAvailable(runtime, 'bun', ['bun', 'upgrade']))
  await step(
    'deno',
    () => runIfAvailable(runtime, 'deno', ['deno', 'upgrade']),
  )

  await updateNodeEcosystem(runtime, hasFnm, initialNpmPackages, step)

  await step(
    'yt-dlp',
    () => runIfAvailable(runtime, 'yt-dlp', ['yt-dlp', '-U']),
  )
  await step(
    'claude',
    () => runIfAvailable(runtime, 'claude', ['claude', 'update']),
  )
  await step(
    'pi',
    () => runIfAvailable(runtime, 'pi', ['pi', 'update', '--all']),
  )
  await step(
    'opencode',
    () => runIfAvailable(runtime, 'opencode', ['opencode', 'upgrade']),
  )
  await step(
    'cursor-agent',
    () => runIfAvailable(runtime, 'cursor-agent', ['cursor-agent', 'update']),
  )
  await step(
    'copilot',
    () => runIfAvailable(runtime, 'copilot', ['copilot', 'update']),
  )
  await step(
    'brew',
    () => runIfAvailable(runtime, 'brew', ['brew', 'upgrade']),
  )

  if (runtime.platform === 'linux') {
    await updateLinuxPackages(runtime, step)
  }

  if (failures.length > 0) {
    console.error(
      `Update completed with ${failures.length} failure(s): ${
        failures.join(', ')
      }`,
    )
    throw new Error(
      `Update completed with ${failures.length} failure(s): ${
        failures.join(', ')
      }`,
    )
  }

  console.log('Update completed successfully!')
}

type StepRunner = (
  label: string,
  fn: () => Promise<unknown>,
) => Promise<void>

async function updateNodeEcosystem(
  runtime: UpdateRuntime,
  hasFnm: boolean,
  initialNpmPackages: string[],
  step: StepRunner,
): Promise<void> {
  if (hasFnm) {
    await step(
      'fnm install',
      () => runtime.run(['fnm', 'install', FNM_NODE_VERSION]),
    )
    await step(
      'fnm default',
      () => runtime.run(['fnm', 'default', FNM_NODE_VERSION]),
    )
  }

  let npmAvailable = false
  await step('npm check', async () => {
    npmAvailable = await nodeCommandExists(runtime, hasFnm, 'npm')
  })
  if (npmAvailable) {
    await step(
      'npm restore missing packages',
      () =>
        restoreMissingGlobalNpmPackages(
          runtime,
          initialNpmPackages,
          hasFnm,
        ),
    )
    await step(
      'npm update --global',
      () => runtime.run(prefixWithFnm(hasFnm, ['npm', 'update', '--global'])),
    )
  }

  let pnpmAvailable = false
  await step('pnpm check', async () => {
    pnpmAvailable = await nodeCommandExists(runtime, hasFnm, 'pnpm')
  })
  if (pnpmAvailable) {
    await step(
      'pnpm self-update',
      () => runtime.run(prefixWithFnm(hasFnm, ['pnpm', 'self-update'])),
    )
    await step(
      'pnpm update --global',
      () => runtime.run(prefixWithFnm(hasFnm, ['pnpm', 'update', '--global'])),
    )
  }
}

async function updateLinuxPackages(
  runtime: UpdateRuntime,
  step: StepRunner,
): Promise<void> {
  await step('git-credential-manager', async () => {
    if (await runtime.commandExists('git-credential-manager')) {
      await runtime.updateGitCredentialManager()
    }
  })

  await step(
    'snap',
    () => runIfAvailable(runtime, 'snap', ['sudo', 'snap', 'refresh']),
  )
  await step(
    'dnf',
    () =>
      runIfAvailable(runtime, 'dnf', [
        'sudo',
        'dnf',
        'upgrade',
        '--refresh',
      ]),
  )

  let hasApt = false
  await step('apt check', async () => {
    hasApt = await runtime.commandExists('apt')
  })
  if (hasApt) {
    await step('apt update', () => runtime.run(['sudo', 'apt', 'update']))
    await step('apt upgrade', () => runtime.run(['sudo', 'apt', 'upgrade']))
  }
}

export function prefixWithFnm(
  useFnmNode: boolean,
  command: string[],
): string[] {
  if (!useFnmNode) {
    return command
  }

  return ['fnm', 'exec', '--using', FNM_NODE_VERSION, ...command]
}

async function nodeCommandExists(
  runtime: UpdateRuntime,
  useFnmNode: boolean,
  command: string,
): Promise<boolean> {
  if (!useFnmNode) {
    return await runtime.commandExists(command)
  }

  const result = await runtime.runQuiet(
    prefixWithFnm(useFnmNode, [command, '--version']),
  )
  return result.code === 0
}

async function runIfAvailable(
  runtime: UpdateRuntime,
  commandName: string,
  command: string[],
): Promise<boolean> {
  if (!await runtime.commandExists(commandName)) {
    return false
  }

  await runtime.run(command)
  return true
}

async function restoreMissingGlobalNpmPackages(
  runtime: UpdateRuntime,
  initialPackages: string[],
  useFnmNode: boolean,
) {
  if (initialPackages.length === 0) {
    return
  }

  const currentPackages = await getGlobalNpmPackages(runtime, useFnmNode)
  const missingPackages = initialPackages.filter((pkg) =>
    !currentPackages.includes(pkg)
  )

  if (missingPackages.length === 0) {
    console.log('All global npm packages are already installed')
    return
  }

  console.log(
    'Reinstalling missing global packages:',
    missingPackages.join(', '),
  )
  await runtime.run(
    prefixWithFnm(useFnmNode, ['npm', 'install', '-g', ...missingPackages]),
  )
}

async function getGlobalNpmPackages(
  runtime: UpdateRuntime,
  useFnmNode: boolean = false,
): Promise<string[]> {
  try {
    if (!useFnmNode && !await runtime.commandExists('npm')) {
      return []
    }

    const result = await runtime.runQuiet(
      prefixWithFnm(useFnmNode, ['npm', 'ls', '-g', '--json']),
    )
    if (result.code !== 0) {
      console.log('Warning: npm ls command failed with code:', result.code)
      return []
    }

    const json = JSON.parse(result.stdout)
    if (json && typeof json === 'object' && 'dependencies' in json) {
      return Object.keys(json.dependencies)
    }

    console.log(
      'Warning: Unexpected npm ls output format. Continuing without package tracking.',
    )
    return []
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.log('Warning: Failed to get global npm packages:', message)
    console.log('Continuing node update without package tracking.')
    return []
  }
}

function createRuntime(): UpdateRuntime {
  const run = async (command: string[]): Promise<void> => {
    console.log(`Running: ${command.join(' ')}`)
    const child = new Deno.Command(command[0], {
      args: command.slice(1),
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    }).spawn()
    const status = await child.status
    if (!status.success) {
      throw new Error(
        `Command failed with code ${status.code}: ${command.join(' ')}`,
      )
    }
  }

  return {
    platform: Deno.build.os,
    async commandExists(command: string): Promise<boolean> {
      const child = new Deno.Command('which', {
        args: [command],
        stdout: 'null',
        stderr: 'null',
      }).spawn()
      const status = await child.status
      return status.success
    },
    run,
    async runQuiet(command: string[]): Promise<CommandResult> {
      const output = await new Deno.Command(command[0], {
        args: command.slice(1),
        stdout: 'piped',
        stderr: 'null',
      }).output()

      return {
        code: output.code,
        stdout: textDecoder.decode(output.stdout),
      }
    },
    async updateGitCredentialManager(): Promise<void> {
      await run([
        'deno',
        'run',
        '-A',
        'jsr:@patdx/pkg',
        'add',
        'git-credential-manager',
      ])
    },
  }
}
