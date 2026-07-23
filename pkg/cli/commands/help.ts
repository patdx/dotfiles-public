import { availableProviders } from '../../shared/url-checker.ts'
import { DEFAULT_REMOTE_REPO } from '../../shared/schema.ts'

export function printHelp(): void {
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
