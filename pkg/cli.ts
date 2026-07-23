import { parseArgs } from '@std/cli/parse-args'
import { join } from '@std/path'
import { homedir as getHomeDir } from 'node:os'
import {
  checkPackageUpdates,
  type PackageUpdateCheck,
} from './check-updates.ts'
import { downloadAndInstall } from './install-binary.ts'
import { availableProviders } from './shared/url-checker.ts'
import { listInstalledPackages, removePackage } from './shared/shared.ts'
import { resolvePackage } from './resolve.ts'
import {
  listAvailablePackageNames,
  loadConfig,
  normalizeRepoBase,
  saveConfig,
  updateAllRepoCaches,
} from './shared/repo-cache.ts'
import { DEFAULT_REMOTE_REPO } from './shared/schema.ts'
import { maybeNotifyCliUpdate } from './shared/cli-update-check.ts'

const SELF_INSTALL_ARGS = [
  'install',
  '-g',
  '-A',
  '-f',
  '-n',
  'ppkg',
  // Allow freshly published JSR versions (Deno default min age is 24h).
  '--min-dep-age=0',
  'jsr:@patdx/pkg',
] as const

async function main(inputArgs: string[]): Promise<void> {
  await maybeNotifyCliUpdate()

  const args = parseArgs(inputArgs, {
    string: ['url', 'url-provider', 'version', 'name'],
    boolean: ['help'],
    alias: {
      h: 'help',
      n: 'name',
    },
  })

  if (args.help) {
    printHelp()
    Deno.exit(0)
  }

  const [command, subcommand, ...rest] = args._

  if (command === 'self-install' || command === 'self-update') {
    await runSelfInstall()
    return
  }

  if (command === 'list') {
    const [packages, availablePackages] = await Promise.all([
      listInstalledPackages(),
      listAvailablePackageNames(),
    ])

    console.log('Installed packages:')
    if (packages.length === 0) {
      console.log('  No packages installed')
    } else {
      for (const pkg of packages) {
        console.log(`  ${pkg.name} (${pkg.version})`)
      }
    }

    console.log('\nAvailable packages:')
    if (availablePackages.length === 0) {
      console.log('  No packages available')
    } else {
      for (const pkg of availablePackages) {
        console.log(`  ${pkg.name}`)
      }
    }
    return
  }

  if (command === 'repo') {
    await handleRepoCommand(
      typeof subcommand === 'string' ? subcommand : undefined,
      rest,
    )
    return
  }

  if (command === 'outdated') {
    await handleOutdatedCommand()
    return
  }

  if (command === 'update') {
    const names = [subcommand, ...rest]
      .filter((value): value is string => typeof value === 'string')
    await handleUpdateCommand(names)
    return
  }

  if (command === 'remove') {
    if (!subcommand || typeof subcommand !== 'string') {
      console.error('Error: Package name is required')
      printHelp()
      Deno.exit(1)
    }

    const result = await removePackage(subcommand)
    if (!result.success) {
      console.error(result.error)
      Deno.exit(1)
    }

    console.log(`Successfully removed package '${subcommand}'`)
    return
  }

  if (command === 'add') {
    const specifier = args.url || subcommand

    if (!specifier || typeof specifier !== 'string') {
      console.error(
        'Error: URL or package name is required. Provide it as --url flag or first argument',
      )
      printHelp()
      Deno.exit(1)
    }

    const isURL = URL.canParse(specifier)

    if (isURL) {
      await downloadAndInstall({
        binary_name: args.name,
        version: args.version,
        files: [{
          url: specifier,
          url_provider: args['url-provider'],
        }],
      })
    } else {
      try {
        const knownPackage = await resolvePackage(specifier)
        await downloadAndInstall(knownPackage)
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : String(error),
        )
        printHelp()
        Deno.exit(1)
      }
    }
    return
  }

  printHelp()
  Deno.exit(1)
}

async function denoOnPath(): Promise<boolean> {
  try {
    const output = await new Deno.Command('which', {
      args: ['deno'],
      stdout: 'null',
      stderr: 'null',
    }).output()
    return output.success
  } catch {
    return false
  }
}

async function runSelfInstall(): Promise<void> {
  if (!await denoOnPath()) {
    console.error('Error: deno is not installed or not on PATH')
    Deno.exit(1)
  }

  console.log(`Running: deno ${SELF_INSTALL_ARGS.join(' ')}`)
  const child = new Deno.Command('deno', {
    args: [...SELF_INSTALL_ARGS],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn()
  const status = await child.status
  if (!status.success) {
    console.error(
      `Error: deno install failed with code ${status.code ?? 1}`,
    )
    Deno.exit(status.code || 1)
  }

  const denoBin = join(getHomeDir() || '', '.deno', 'bin')
  const path = Deno.env.get('PATH') || ''
  if (!path.split(':').includes(denoBin)) {
    console.log(
      `\nAdd Deno's bin directory to your PATH if needed:\n  export PATH="$HOME/.deno/bin:$PATH"`,
    )
  }
  console.log('\nInstalled as: ppkg')
}

async function handleOutdatedCommand(): Promise<void> {
  const installed = await listInstalledPackages()
  if (installed.length === 0) {
    console.log('No packages installed')
    return
  }

  const checks = await checkPackageUpdates(installed)
  printUpdateChecks(checks)

  const outdated = checks.filter((check) => check.status === 'outdated')
  if (outdated.length > 0) {
    Deno.exit(1)
  }
}

async function handleUpdateCommand(names: string[]): Promise<void> {
  const installed = await listInstalledPackages()
  if (installed.length === 0) {
    console.log('No packages installed')
    return
  }

  let checks: PackageUpdateCheck[]
  try {
    checks = await checkPackageUpdates(installed, {
      names: names.length > 0 ? names : undefined,
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    Deno.exit(1)
  }

  for (const check of checks) {
    if (check.status === 'skipped') {
      console.log(
        `  ${check.name}: skipped (${check.reason ?? 'not in catalog'})`,
      )
    } else if (check.status === 'error') {
      console.error(
        `  ${check.name}: error (${check.reason ?? 'unknown error'})`,
      )
    }
  }

  const toUpdate = names.length > 0
    ? checks.filter((check) =>
      check.status === 'outdated' || check.status === 'current'
    )
    : checks.filter((check) => check.status === 'outdated')

  if (toUpdate.length === 0) {
    const hadCatalog = checks.some((check) =>
      check.status === 'outdated' || check.status === 'current'
    )
    if (hadCatalog) {
      console.log('All catalog packages are up to date')
    } else {
      console.log('No catalog packages to update')
    }
    if (checks.some((check) => check.status === 'error')) {
      Deno.exit(1)
    }
    return
  }

  let failed = 0
  for (const check of toUpdate) {
    if (!check.resolved) {
      console.error(`  ${check.name}: missing resolved package`)
      failed++
      continue
    }
    if (check.status === 'current') {
      console.log(`  ${check.name}: ${check.installed} (up to date)`)
      continue
    }
    console.log(
      `Updating ${check.name}: ${check.installed} → ${check.available}`,
    )
    try {
      await downloadAndInstall(check.resolved)
    } catch (error) {
      console.error(
        `  ${check.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      failed++
    }
  }

  if (failed > 0 || checks.some((check) => check.status === 'error')) {
    Deno.exit(1)
  }
}

function printUpdateChecks(checks: PackageUpdateCheck[]): void {
  let shown = 0
  for (const check of checks) {
    if (check.status === 'outdated') {
      console.log(
        `  ${check.name}: ${check.installed} → ${check.available}`,
      )
      shown++
    } else if (check.status === 'current') {
      console.log(`  ${check.name}: ${check.installed} (up to date)`)
      shown++
    } else if (check.status === 'skipped') {
      console.log(
        `  ${check.name}: skipped (${check.reason ?? 'not in catalog'})`,
      )
      shown++
    } else if (check.status === 'error') {
      console.error(
        `  ${check.name}: error (${check.reason ?? 'unknown error'})`,
      )
      shown++
    }
  }
  if (shown === 0) {
    console.log('No packages to check')
  }
}

async function handleRepoCommand(
  subcommand: string | undefined,
  rest: Array<string | number>,
): Promise<void> {
  if (subcommand === 'list') {
    const config = await loadConfig()
    console.log('Configured repos:')
    for (const entry of config.repos) {
      console.log(`  ${entry.url}`)
    }
    if (config.repos.length === 0) {
      console.log(`  (default) ${DEFAULT_REMOTE_REPO}`)
    }
    return
  }

  if (subcommand === 'add') {
    const url = rest[0]
    if (!url || typeof url !== 'string') {
      console.error('Error: repo URL is required')
      console.error('Usage: ppkg repo add <url>')
      Deno.exit(1)
    }
    const config = await loadConfig()
    const normalized = normalizeRepoBase(url)
    if (
      config.repos.some((entry) => normalizeRepoBase(entry.url) === normalized)
    ) {
      console.log(`Repo already configured: ${normalized}`)
      return
    }
    config.repos.push({ url: normalized })
    await saveConfig(config)
    console.log(`Added repo: ${normalized}`)
    return
  }

  if (subcommand === 'remove') {
    const url = rest[0]
    if (!url || typeof url !== 'string') {
      console.error('Error: repo URL is required')
      console.error('Usage: ppkg repo remove <url>')
      Deno.exit(1)
    }
    const config = await loadConfig()
    const normalized = normalizeRepoBase(url)
    const next = config.repos.filter((entry) =>
      normalizeRepoBase(entry.url) !== normalized
    )
    if (next.length === config.repos.length) {
      console.error(`Repo not found: ${normalized}`)
      Deno.exit(1)
    }
    await saveConfig({ repos: next })
    console.log(`Removed repo: ${normalized}`)
    return
  }

  if (subcommand === 'update') {
    const updated = await updateAllRepoCaches()
    if (updated.length === 0) {
      console.log('No repos updated')
    } else {
      console.log('Updated repos:')
      for (const base of updated) {
        console.log(`  ${base}`)
      }
    }
    return
  }

  console.error('Usage: ppkg repo list|add|remove|update')
  Deno.exit(1)
}

function printHelp(): void {
  console.log(`Usage: ppkg <command> [options]

Commands:
  add <name|url>      Install a known package or binary from URL
  list                List installed and available packages
  outdated            Show installed packages with available updates
  update [name...]    Update outdated packages (or named packages)
  remove <pkg>        Remove an installed package
  repo list           List configured remote repos
  repo add <url>      Add a remote repo base URL
  repo remove <url>   Remove a remote repo
  repo update         Refresh cached repo/package JSON
  self-install        Install this CLI globally as ppkg
  self-update         Reinstall latest @patdx/pkg as ppkg

Options:
  --url <url>         URL to download the binary from (can also be provided as first argument)
  --name <name>       Name for the binary (default: extracted from URL)
  --version <ver>     Specific version to install (default: latest)
  --url-provider      Specify URL provider (${availableProviders.join(', ')})
  -h, --help          Show this help message

Default remote: ${DEFAULT_REMOTE_REPO}

Examples:
  ppkg list
  ppkg outdated
  ppkg update
  ppkg update caddy duckdb
  ppkg remove mycli
  ppkg add windsurf
  ppkg add https://github.com/org/repo
  ppkg add --url https://github.com/org/repo --name mycli
  ppkg add --url https://github.com/org/repo --url-provider github
  ppkg repo add https://example.com/my-pkg-repo
  ppkg self-install
  ppkg self-update
`)
}

if (import.meta.main) {
  await main(Deno.args)
}
