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

/**
 * A globally installed npm package. Packages installed from a local directory
 * (`npm link` or `npm install -g <dir>`) are not published on the registry, so
 * they have to be restored from their source path instead.
 */
export interface GlobalNpmPackage {
  name: string
  /** True when the package is linked to a local directory. */
  local: boolean
  /** Absolute path to the local source directory, when npm reported one. */
  localPath?: string
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

  let initialNpmPackages: GlobalNpmPackage[] = []
  await step('npm package inventory', async () => {
    initialNpmPackages = await getGlobalNpmPackageInventory(runtime)
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
    'cmd',
    () => runIfAvailable(runtime, 'cmd', ['cmd', 'update']),
  )
  await step(
    'herdr',
    () => runIfAvailable(runtime, 'herdr', ['herdr', 'update']),
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
  initialNpmPackages: GlobalNpmPackage[],
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
    // Updating global Corepack can recreate shims over standalone pnpm.
    await step(
      'npm uninstall corepack',
      () =>
        runtime.run(
          prefixWithFnm(hasFnm, ['npm', 'uninstall', '--global', 'corepack']),
        ),
    )
    await step(
      'npm restore missing packages',
      () =>
        restoreMissingGlobalNpmPackages(
          runtime,
          initialNpmPackages.filter((pkg) => pkg.name !== 'corepack'),
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
    // Standalone pnpm belongs to the shell, not fnm's Node installation.
    // fnm exec can shadow it with a leftover Corepack shim.
    pnpmAvailable = await runtime.commandExists('pnpm')
  })
  if (pnpmAvailable) {
    await step(
      'pnpm self-update',
      () => runtime.run(['pnpm', 'self-update']),
    )
    await step(
      'pnpm update --global',
      () => runtime.run(['pnpm', 'update', '--global']),
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
  initialPackages: GlobalNpmPackage[],
  useFnmNode: boolean,
): Promise<void> {
  if (initialPackages.length === 0) {
    return
  }

  const currentPackages = await getGlobalNpmPackages(runtime, useFnmNode)
  const missingPackages = initialPackages.filter((pkg) =>
    !currentPackages.includes(pkg.name)
  )

  if (missingPackages.length === 0) {
    console.log('All global npm packages are already installed')
    return
  }

  console.log(
    'Reinstalling missing global packages:',
    missingPackages.map(describeGlobalNpmPackage).join(', '),
  )

  // Install one package at a time. Installing them in a single batch means one
  // unavailable package (for example a local package that is not on the
  // registry) would abort the whole install and leave every other package
  // missing.
  const failures: GlobalNpmPackage[] = []
  for (const pkg of missingPackages) {
    const installed = await reinstallGlobalNpmPackage(runtime, pkg, useFnmNode)
    if (!installed) {
      failures.push(pkg)
    }
  }

  // Local packages are expected to be unavailable on the registry: they were
  // already reported as warnings and there is nothing else to fall back to.
  const registryFailures = failures.filter((pkg) => !pkg.local)
  if (registryFailures.length > 0) {
    throw new Error(
      `Failed to reinstall ${registryFailures.length} global npm package(s): ${
        registryFailures.map((pkg) => pkg.name).join(', ')
      }`,
    )
  }
}

function describeGlobalNpmPackage(pkg: GlobalNpmPackage): string {
  if (!pkg.local) {
    return pkg.name
  }

  return `${pkg.name} (local: ${pkg.localPath ?? 'path unknown'})`
}

/**
 * Restores a single global npm package. Linked/local packages are installed
 * from their source directory rather than by name, because they are not
 * published on the npm registry.
 */
async function reinstallGlobalNpmPackage(
  runtime: UpdateRuntime,
  pkg: GlobalNpmPackage,
  useFnmNode: boolean,
): Promise<boolean> {
  const target = pkg.localPath ?? pkg.name

  try {
    await runtime.run(
      prefixWithFnm(useFnmNode, ['npm', 'install', '-g', target]),
    )
    return true
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (pkg.local) {
      const source = pkg.localPath ? ` from ${pkg.localPath}` : ''
      console.log(
        `Warning: Could not restore local package ${pkg.name}${source}: ${message}`,
      )
      console.log(`Install it manually with: npm install -g ${target}`)
    } else {
      console.log(`Warning: Could not restore package ${pkg.name}: ${message}`)
    }
    return false
  }
}

/**
 * Parses `npm ls -g --json` output.
 *
 * npm reports local installs as `file:` paths that are relative to the global
 * `node_modules` directory in use at the time, so that root has to be passed in
 * to resolve them to an absolute path. Returns undefined when the output does
 * not have the expected shape.
 */
export function parseGlobalNpmPackages(
  stdout: string,
  globalNodeModulesRoot?: string,
): GlobalNpmPackage[] | undefined {
  const json: unknown = JSON.parse(stdout)
  if (!isRecord(json) || !isRecord(json.dependencies)) {
    return undefined
  }

  return Object.entries(json.dependencies).map(([name, value]) => {
    const entry = isRecord(value) ? value : {}
    const source = getLocalSource(entry)

    return {
      name,
      local: entry.link === true || source !== undefined,
      localPath: source === undefined
        ? undefined
        : resolveLocalSource(source, globalNodeModulesRoot),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getLocalSource(entry: Record<string, unknown>): string | undefined {
  const resolved = entry.resolved
  if (typeof resolved !== 'string' || resolved === '') {
    return undefined
  }

  if (entry.link === true || resolved.startsWith('file:')) {
    const source = resolved.replace(/^file:/, '')
    return source === '' ? undefined : source
  }

  return undefined
}

function resolveLocalSource(
  source: string,
  globalNodeModulesRoot?: string,
): string | undefined {
  if (source.startsWith('/')) {
    return normalizeAbsolutePath(source)
  }

  if (globalNodeModulesRoot === undefined) {
    return undefined
  }

  return normalizeAbsolutePath(`${globalNodeModulesRoot}/${source}`)
}

function normalizeAbsolutePath(path: string): string {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  return `/${segments.join('/')}`
}

async function getGlobalNpmPackages(
  runtime: UpdateRuntime,
  useFnmNode: boolean = false,
): Promise<string[]> {
  const packages = await getGlobalNpmPackageInventory(runtime, useFnmNode)
  return packages.map((pkg) => pkg.name)
}

async function getGlobalNpmPackageInventory(
  runtime: UpdateRuntime,
  useFnmNode: boolean = false,
): Promise<GlobalNpmPackage[]> {
  try {
    if (!useFnmNode && !await runtime.commandExists('npm')) {
      return []
    }

    // npm resolves the paths of linked packages relative to the global
    // node_modules directory, so capture it while the packages are still there.
    const rootResult = await runtime.runQuiet(
      prefixWithFnm(useFnmNode, ['npm', 'root', '-g']),
    )
    const root = rootResult.code === 0 ? rootResult.stdout.trim() : ''

    const result = await runtime.runQuiet(
      prefixWithFnm(useFnmNode, ['npm', 'ls', '-g', '--json']),
    )
    if (result.code !== 0) {
      console.log('Warning: npm ls command failed with code:', result.code)
      return []
    }

    const packages = parseGlobalNpmPackages(result.stdout, root || undefined)
    if (packages === undefined) {
      console.log(
        'Warning: Unexpected npm ls output format. Continuing without package tracking.',
      )
      return []
    }

    return packages
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
