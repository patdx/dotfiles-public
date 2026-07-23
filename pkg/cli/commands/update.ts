import {
  checkPackageUpdates,
  type PackageUpdateCheck,
} from '../../check-updates.ts'
import { downloadAndInstall } from '../../install-binary.ts'
import { listInstalledPackages } from '../../shared/fs.ts'

export async function handleUpdateCommand(names: string[]): Promise<void> {
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

  const toUpdate = selectUpdateTargets(checks, names)

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
    const ok = await applyUpdate(check)
    if (!ok) failed++
  }

  if (failed > 0 || checks.some((check) => check.status === 'error')) {
    Deno.exit(1)
  }
}

function selectUpdateTargets(
  checks: PackageUpdateCheck[],
  names: string[],
): PackageUpdateCheck[] {
  if (names.length > 0) {
    return checks.filter((check) =>
      check.status === 'outdated' || check.status === 'current'
    )
  }
  return checks.filter((check) => check.status === 'outdated')
}

async function applyUpdate(check: PackageUpdateCheck): Promise<boolean> {
  if (!check.resolved) {
    console.error(`  ${check.name}: missing resolved package`)
    return false
  }
  if (check.status === 'current') {
    console.log(`  ${check.name}: ${check.installed} (up to date)`)
    return true
  }
  console.log(
    `Updating ${check.name}: ${check.installed} → ${check.available}`,
  )
  try {
    await downloadAndInstall(check.resolved)
    return true
  } catch (error) {
    console.error(
      `  ${check.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return false
  }
}
