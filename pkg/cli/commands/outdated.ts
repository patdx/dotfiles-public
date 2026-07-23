import {
  checkPackageUpdates,
  type PackageUpdateCheck,
} from '../../check-updates.ts'
import { listInstalledPackages } from '../../shared/fs.ts'

export async function handleOutdatedCommand(): Promise<void> {
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
