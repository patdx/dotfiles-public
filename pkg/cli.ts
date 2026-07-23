import { parseArgs } from '@std/cli/parse-args'
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

async function main(inputArgs: string[]): Promise<void> {
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
      console.error('Usage: pkg repo add <url>')
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
      console.error('Usage: pkg repo remove <url>')
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

  console.error('Usage: pkg repo list|add|remove|update')
  Deno.exit(1)
}

function printHelp(): void {
  console.log(`Usage: pkg <command> [options]

Commands:
  add <name|url>      Install a known package or binary from URL
  list                List installed and available packages
  remove <pkg>        Remove an installed package
  repo list           List configured remote repos
  repo add <url>      Add a remote repo base URL
  repo remove <url>   Remove a remote repo
  repo update         Refresh cached repo/package JSON

Options:
  --url <url>         URL to download the binary from (can also be provided as first argument)
  --name <name>       Name for the binary (default: extracted from URL)
  --version <ver>     Specific version to install (default: latest)
  --url-provider      Specify URL provider (${availableProviders.join(', ')})
  -h, --help          Show this help message

Default remote: ${DEFAULT_REMOTE_REPO}

Examples:
  pkg list
  pkg remove mycli
  pkg add windsurf
  pkg add https://github.com/org/repo
  pkg add --url https://github.com/org/repo --name mycli
  pkg add --url https://github.com/org/repo --url-provider github
  pkg repo add https://example.com/my-pkg-repo
`)
}

if (import.meta.main) {
  await main(Deno.args)
}
